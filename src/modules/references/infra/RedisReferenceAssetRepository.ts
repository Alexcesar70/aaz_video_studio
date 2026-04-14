import type { ReferenceAsset } from '../domain/ReferenceAsset'
import { validateReferenceAsset } from '../domain/ReferenceAsset'
import type {
  ReferenceAssetRepository,
  ReferenceAssetListFilter,
} from '../ports/ReferenceAssetRepository'
import { getRedis } from '@/lib/redis'

/**
 * Repository Redis para ReferenceAsset.
 *
 * Layout de chaves:
 *   aaz:reference:{id}                         → JSON
 *   aaz:reference:index:user:{userId}          → Sorted Set (score=createdAt ms)
 *   aaz:reference:index:ws:{workspaceId}       → Sorted Set
 *   aaz:reference:index:all                    → Sorted Set (admin listing)
 *
 * Escolha consciente: sem TTL — referências ficam até serem removidas
 * explicitamente (a mídia no Blob sobreviveu, a referência deve
 * também). A rota DELETE pode opcionalmente remover do Blob.
 */
const KEY_PREFIX = 'aaz:reference:'
const INDEX_USER = 'aaz:reference:index:user:'
const INDEX_WS = 'aaz:reference:index:ws:'
const INDEX_ALL = 'aaz:reference:index:all'

const SYSTEM_SCOPE = '__system__'

function refKey(id: string): string {
  return `${KEY_PREFIX}${id}`
}
function userIndexKey(userId: string): string {
  return `${INDEX_USER}${userId}`
}
function wsIndexKey(workspaceId: string | null): string {
  return `${INDEX_WS}${workspaceId ?? SYSTEM_SCOPE}`
}

export class RedisReferenceAssetRepository
  implements ReferenceAssetRepository
{
  async findById(id: string): Promise<ReferenceAsset | null> {
    const redis = await getRedis()
    const raw = await redis.get(refKey(id))
    if (!raw) return null
    try {
      return JSON.parse(raw) as ReferenceAsset
    } catch (err) {
      console.error('[RedisReferenceAssetRepository] corrupt JSON', { id, err })
      return null
    }
  }

  async list(
    filter?: ReferenceAssetListFilter,
  ): Promise<ReferenceAsset[]> {
    const redis = await getRedis()
    const limit = filter?.limit && filter.limit > 0 ? filter.limit : 50

    let indexKey: string
    if (filter?.userId) {
      indexKey = userIndexKey(filter.userId)
    } else if (filter?.workspaceId !== undefined) {
      indexKey = wsIndexKey(filter.workspaceId)
    } else {
      indexKey = INDEX_ALL
    }

    const overfetch = Math.max(limit * 3, 100)
    const ids = await redis.zRange(indexKey, 0, overfetch - 1, { REV: true })
    if (ids.length === 0) return []

    const results: ReferenceAsset[] = []
    for (const id of ids) {
      const ref = await this.findById(id)
      if (!ref) continue

      if (filter?.userId && ref.userId !== filter.userId) continue
      if (
        filter?.workspaceId !== undefined &&
        ref.workspaceId !== filter.workspaceId
      ) {
        continue
      }
      if (filter?.mediaType && ref.mediaType !== filter.mediaType) continue
      if (filter?.source && ref.source !== filter.source) continue
      if (filter?.since && ref.createdAt < filter.since) continue

      results.push(ref)
      if (results.length >= limit) break
    }
    return results
  }

  async upsert(asset: ReferenceAsset): Promise<ReferenceAsset> {
    const validated = validateReferenceAsset(asset)
    const redis = await getRedis()
    await redis.set(refKey(validated.id), JSON.stringify(validated))

    const score = Date.parse(validated.createdAt)
    await redis.zAdd(userIndexKey(validated.userId), {
      score,
      value: validated.id,
    })
    await redis.zAdd(wsIndexKey(validated.workspaceId), {
      score,
      value: validated.id,
    })
    await redis.zAdd(INDEX_ALL, { score, value: validated.id })

    return validated
  }

  async remove(id: string): Promise<void> {
    const redis = await getRedis()
    const current = await this.findById(id)
    await redis.del(refKey(id))
    await redis.zRem(INDEX_ALL, id)
    if (current) {
      await redis.zRem(userIndexKey(current.userId), id)
      await redis.zRem(wsIndexKey(current.workspaceId), id)
    }
  }
}
