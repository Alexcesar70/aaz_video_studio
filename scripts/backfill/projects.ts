/**
 * Backfill Redis → Postgres para Projects.
 *
 * Lê chaves `aaz:project:*`. Itens sem `organizationId` são
 * "orphans legacy" — tenta resolver via lookup do `createdBy`
 * (busca o user no Redis e usa seu organizationId). Se ainda
 * não der, ALERTA e pula (não escreve no Postgres com workspaceId
 * inválido — FK rejeitaria).
 *
 * Como rodar:
 *   npx tsx scripts/backfill/projects.ts
 */

import { getRedis } from '@/lib/redis'
import {
  PostgresProjectRepository,
  validateProject,
} from '@/modules/projects'

interface RedisProjectShape {
  id: string
  name: string
  createdAt: string
  createdBy?: string
  memberIds?: string[]
  organizationId?: string
}

interface RedisUserShape {
  organizationId?: string
}

interface BackfillResult {
  read: number
  written: number
  skipped_orphan: number
  skipped_no_user: Array<{ id: string; createdBy: string | undefined }>
  errors: Array<{ id: string; error: string }>
}

async function resolveOrgIdFromUser(
  redis: Awaited<ReturnType<typeof getRedis>>,
  userId: string | undefined,
): Promise<string | null> {
  if (!userId) return null
  const raw = await redis.get(`aaz:user:${userId}`)
  if (!raw) return null
  try {
    const u = JSON.parse(raw) as RedisUserShape
    return u.organizationId ?? null
  } catch {
    return null
  }
}

async function run(): Promise<BackfillResult> {
  const redis = await getRedis()
  const repo = new PostgresProjectRepository()

  const keys = await redis.keys('aaz:project:*')
  const result: BackfillResult = {
    read: 0,
    written: 0,
    skipped_orphan: 0,
    skipped_no_user: [],
    errors: [],
  }

  for (const key of keys) {
    result.read++
    try {
      const raw = await redis.get(key)
      if (!raw) continue
      const obj = JSON.parse(raw) as RedisProjectShape
      let workspaceId = obj.organizationId
      if (!workspaceId) {
        const resolved = await resolveOrgIdFromUser(redis, obj.createdBy)
        if (resolved) {
          workspaceId = resolved
        } else {
          result.skipped_no_user.push({ id: obj.id, createdBy: obj.createdBy })
          continue
        }
      }
      const project = validateProject({
        id: obj.id,
        name: obj.name,
        workspaceId,
        createdBy: obj.createdBy ?? 'system',
        memberIds: obj.memberIds ?? [],
        createdAt: obj.createdAt,
        updatedAt: obj.createdAt,
      })
      await repo.upsert(project)
      result.written++
    } catch (err) {
      result.errors.push({
        id: key,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return result
}

run()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2))
    process.exit(r.errors.length > 0 || r.skipped_no_user.length > 0 ? 1 : 0)
  })
  .catch((err) => {
    console.error('Backfill failed:', err)
    process.exit(2)
  })
