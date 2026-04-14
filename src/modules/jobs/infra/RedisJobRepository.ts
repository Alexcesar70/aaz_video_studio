import type { Job } from '../domain/Job'
import { validateJob } from '../domain/Job'
import type {
  JobRepository,
  JobListFilter,
} from '../ports/JobRepository'
import { getRedis } from '@/lib/redis'

/**
 * Repository Redis para Job.
 *
 * Layout de chaves:
 *   aaz:job:{id}                         → JSON do Job
 *   aaz:job:index:user:{userId}          → Sorted Set (score=createdAt epoch ms)
 *   aaz:job:index:ws:{workspaceId}       → Sorted Set idem (chave __system__ para workspaceId=null)
 *   aaz:job:index:all                    → Sorted Set idem (admin listing)
 *
 * Escolha consciente: sorted sets permitem listar "últimos N" em O(log n).
 * Jobs terminais (completed/failed/canceled) ganham TTL via EXPIRE — o
 * valor default é 30 dias.
 */
const JOB_KEY_PREFIX = 'aaz:job:'
const INDEX_USER = 'aaz:job:index:user:'
const INDEX_WS = 'aaz:job:index:ws:'
const INDEX_ALL = 'aaz:job:index:all'

const SYSTEM_SCOPE = '__system__'
const TERMINAL_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 dias

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'canceled'])

function jobKey(id: string): string {
  return `${JOB_KEY_PREFIX}${id}`
}
function userIndexKey(userId: string): string {
  return `${INDEX_USER}${userId}`
}
function wsIndexKey(workspaceId: string | null): string {
  return `${INDEX_WS}${workspaceId ?? SYSTEM_SCOPE}`
}

export class RedisJobRepository implements JobRepository {
  async findById(id: string): Promise<Job | null> {
    const redis = await getRedis()
    const raw = await redis.get(jobKey(id))
    if (!raw) return null
    try {
      return JSON.parse(raw) as Job
    } catch (err) {
      console.error('[RedisJobRepository] corrupt JSON', { id, err })
      return null
    }
  }

  async list(filter?: JobListFilter): Promise<Job[]> {
    const redis = await getRedis()
    const limit = filter?.limit && filter.limit > 0 ? filter.limit : 50

    // Escolhe o índice mais restritivo disponível.
    let indexKey: string
    if (filter?.userId) {
      indexKey = userIndexKey(filter.userId)
    } else if (filter?.workspaceId !== undefined) {
      indexKey = wsIndexKey(filter.workspaceId)
    } else {
      indexKey = INDEX_ALL
    }

    // Mais recentes primeiro → ZRANGE com REV.
    // Buscamos mais que o limite pra cobrir filtros pós-leitura sem paginação.
    const overfetch = Math.max(limit * 3, 100)
    const ids = await redis.zRange(indexKey, 0, overfetch - 1, { REV: true })
    if (ids.length === 0) return []

    const results: Job[] = []
    for (const id of ids) {
      const job = await this.findById(id)
      if (!job) continue

      // Filtros pós-leitura
      if (filter?.userId && job.userId !== filter.userId) continue
      if (
        filter?.workspaceId !== undefined &&
        job.workspaceId !== filter.workspaceId
      ) {
        continue
      }
      if (filter?.kind && job.kind !== filter.kind) continue
      if (filter?.status && job.status !== filter.status) continue
      if (filter?.since && job.createdAt < filter.since) continue

      results.push(job)
      if (results.length >= limit) break
    }
    return results
  }

  async upsert(job: Job): Promise<Job> {
    const validated = validateJob(job)
    const redis = await getRedis()
    const key = jobKey(validated.id)

    await redis.set(key, JSON.stringify(validated))

    const score = Date.parse(validated.createdAt)
    await redis.zAdd(userIndexKey(validated.userId), { score, value: validated.id })
    await redis.zAdd(wsIndexKey(validated.workspaceId), { score, value: validated.id })
    await redis.zAdd(INDEX_ALL, { score, value: validated.id })

    // TTL em status terminais — mantém histórico por 30 dias e libera memória.
    if (TERMINAL_STATUSES.has(validated.status)) {
      await redis.expire(key, TERMINAL_TTL_SECONDS)
    } else {
      // Se voltou de terminal (não deveria pelo grafo, mas defensive), garante sem TTL.
      await redis.persist(key)
    }

    return validated
  }

  async remove(id: string): Promise<void> {
    const redis = await getRedis()
    const job = await this.findById(id)
    await redis.del(jobKey(id))
    await redis.zRem(INDEX_ALL, id)
    if (job) {
      await redis.zRem(userIndexKey(job.userId), id)
      await redis.zRem(wsIndexKey(job.workspaceId), id)
    }
  }
}
