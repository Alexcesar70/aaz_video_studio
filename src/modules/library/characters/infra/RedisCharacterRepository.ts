import type { Character } from '../domain/Character'
import { validateCharacter } from '../domain/Character'
import type {
  CharacterRepository,
  CharacterListFilter,
} from '../ports/CharacterRepository'
import { getRedis } from '@/lib/redis'

/**
 * Repository Redis para Character, com histórico de versões.
 *
 * Layout de chaves:
 *   aaz:character:global:{slug}                 → versão corrente global
 *   aaz:character:ws:{workspaceId}:{slug}       → versão corrente do workspace
 *   aaz:character:history:global:{slug}         → Lista (LPUSH) de versões arquivadas
 *   aaz:character:history:ws:{workspaceId}:{slug} → Idem para workspace
 *   aaz:character:index                         → Set de "scope::slug" para listagem
 *
 * Escolha consciente: histórico em List (LPUSH → mais recente à esquerda)
 * permite `LRANGE 0 N` para os últimos N sem SCAN.
 */

const GLOBAL_PREFIX = 'aaz:character:global:'
const WS_PREFIX = 'aaz:character:ws:'
const HISTORY_GLOBAL_PREFIX = 'aaz:character:history:global:'
const HISTORY_WS_PREFIX = 'aaz:character:history:ws:'
const INDEX_KEY = 'aaz:character:index'

function currentKey(slug: string, workspaceId: string | null): string {
  return workspaceId
    ? `${WS_PREFIX}${workspaceId}:${slug}`
    : `${GLOBAL_PREFIX}${slug}`
}

function historyKey(slug: string, workspaceId: string | null): string {
  return workspaceId
    ? `${HISTORY_WS_PREFIX}${workspaceId}:${slug}`
    : `${HISTORY_GLOBAL_PREFIX}${slug}`
}

function indexMember(slug: string, workspaceId: string | null): string {
  return `${workspaceId ?? '__global__'}::${slug}`
}

function parseIndexMember(
  member: string,
): { workspaceId: string | null; slug: string } {
  const [scope, ...slugParts] = member.split('::')
  const slug = slugParts.join('::')
  return {
    workspaceId: scope === '__global__' ? null : scope,
    slug,
  }
}

export class RedisCharacterRepository implements CharacterRepository {
  async findBySlug(
    slug: string,
    workspaceId?: string | null,
  ): Promise<Character | null> {
    if (workspaceId) {
      const override = await this.findBySlugExact(slug, workspaceId)
      if (override) return override
    }
    return this.findBySlugExact(slug, null)
  }

  async findBySlugExact(
    slug: string,
    workspaceId: string | null,
  ): Promise<Character | null> {
    const redis = await getRedis()
    const raw = await redis.get(currentKey(slug, workspaceId))
    if (!raw) return null
    try {
      return JSON.parse(raw) as Character
    } catch (err) {
      console.error('[RedisCharacterRepository] corrupt JSON', {
        slug,
        workspaceId,
        err,
      })
      return null
    }
  }

  async list(filter?: CharacterListFilter): Promise<Character[]> {
    const redis = await getRedis()
    const members = await redis.sMembers(INDEX_KEY)
    if (members.length === 0) return []

    const results: Character[] = []
    for (const member of members) {
      const { workspaceId, slug } = parseIndexMember(member)
      if (filter?.workspaceId !== undefined && workspaceId !== filter.workspaceId) {
        continue
      }
      const c = await this.findBySlugExact(slug, workspaceId)
      if (!c) continue
      if (filter?.isOfficial !== undefined && c.isOfficial !== filter.isOfficial) {
        continue
      }
      results.push(c)
    }

    results.sort((a, b) => {
      if (a.isOfficial && !b.isOfficial) return -1
      if (!a.isOfficial && b.isOfficial) return 1
      return b.createdAt.localeCompare(a.createdAt)
    })

    if (filter?.limit && filter.limit > 0) {
      return results.slice(0, filter.limit)
    }
    return results
  }

  async upsert(character: Character): Promise<Character> {
    const validated = validateCharacter(character)
    const redis = await getRedis()
    const curKey = currentKey(validated.slug, validated.workspaceId)

    // Se houver versão anterior com versão diferente, arquiva no histórico.
    const existingRaw = await redis.get(curKey)
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw) as Character
        if (existing.version !== validated.version) {
          await redis.lPush(
            historyKey(validated.slug, validated.workspaceId),
            existingRaw,
          )
        }
      } catch {
        // Ignora JSON corrompido — não bloqueia o upsert.
      }
    }

    await redis.set(curKey, JSON.stringify(validated))
    await redis.sAdd(
      INDEX_KEY,
      indexMember(validated.slug, validated.workspaceId),
    )
    return validated
  }

  async remove(slug: string, workspaceId: string | null): Promise<void> {
    const redis = await getRedis()
    await redis.del(currentKey(slug, workspaceId))
    await redis.sRem(INDEX_KEY, indexMember(slug, workspaceId))
    // histórico preservado intencionalmente
  }

  async listVersions(
    slug: string,
    workspaceId: string | null,
  ): Promise<Character[]> {
    const redis = await getRedis()
    const raws = await redis.lRange(
      historyKey(slug, workspaceId),
      0,
      -1,
    )
    const out: Character[] = []
    for (const r of raws) {
      try {
        out.push(JSON.parse(r) as Character)
      } catch {
        // ignora entradas corrompidas
      }
    }
    return out
  }
}
