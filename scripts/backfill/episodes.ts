/**
 * Backfill Redis → Postgres para Episodes.
 *
 * Mesma estratégia do backfill de projects: orphans sem
 * `organizationId` tentam resolver via user.organizationId. Se
 * o `projectId` referenciar um project que NÃO existe no Postgres,
 * vira null (episódio avulso) — o FK é `set null` no schema.
 *
 * Mapeia `finalVideoSizeMB` (capital MB) do legado para
 * `finalVideoSizeMb` (camelCase) do novo schema.
 *
 * Como rodar:
 *   npx tsx scripts/backfill/episodes.ts
 */

import { getRedis } from '@/lib/redis'
import { getDb } from '@/db/client'
import { projects } from '@/db/schema'
import { eq } from 'drizzle-orm'
import {
  PostgresEpisodeRepository,
  validateEpisode,
  type EpisodeFinalStatus,
} from '@/modules/episodes'

interface RedisEpisodeShape {
  id: string
  name: string
  projectId?: string | null
  createdAt: string
  createdBy?: string
  finalVideoUrl?: string
  finalVideoSizeMB?: number
  finalVideoUploadedAt?: string
  finalVideoUploadedBy?: string
  finalStatus?: EpisodeFinalStatus
  reviewNote?: string
  reviewedAt?: string
  reviewedBy?: string
  creatorNote?: string
  organizationId?: string
}

interface RedisUserShape {
  organizationId?: string
}

interface BackfillResult {
  read: number
  written: number
  project_unlinked: number
  skipped_no_user: Array<{ id: string; createdBy: string | undefined }>
  errors: Array<{ id: string; error: string }>
}

async function run(): Promise<BackfillResult> {
  const redis = await getRedis()
  const db = getDb()
  const repo = new PostgresEpisodeRepository()

  const keys = await redis.keys('aaz:ep:*')
  const result: BackfillResult = {
    read: 0,
    written: 0,
    project_unlinked: 0,
    skipped_no_user: [],
    errors: [],
  }

  for (const key of keys) {
    result.read++
    try {
      const raw = await redis.get(key)
      if (!raw) continue
      const obj = JSON.parse(raw) as RedisEpisodeShape

      // Resolve workspaceId
      let workspaceId = obj.organizationId
      if (!workspaceId && obj.createdBy) {
        const userRaw = await redis.get(`aaz:user:${obj.createdBy}`)
        if (userRaw) {
          try {
            const u = JSON.parse(userRaw) as RedisUserShape
            if (u.organizationId) workspaceId = u.organizationId
          } catch {
            // ignora
          }
        }
      }
      if (!workspaceId) {
        result.skipped_no_user.push({ id: obj.id, createdBy: obj.createdBy })
        continue
      }

      // Valida que o projectId aponta para projeto existente em Postgres
      let projectId = obj.projectId ?? null
      if (projectId) {
        const pgProj = await db
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.id, projectId))
          .limit(1)
        if (pgProj.length === 0) {
          // Project ainda não existe no Postgres → desliga FK pra não quebrar.
          projectId = null
          result.project_unlinked++
        }
      }

      const ep = validateEpisode({
        id: obj.id,
        name: obj.name,
        workspaceId,
        projectId,
        createdBy: obj.createdBy ?? 'system',
        finalVideoUrl: obj.finalVideoUrl,
        finalVideoSizeMb: obj.finalVideoSizeMB, // camelCase no schema
        finalVideoUploadedAt: obj.finalVideoUploadedAt,
        finalVideoUploadedBy: obj.finalVideoUploadedBy,
        finalStatus: obj.finalStatus ?? 'none',
        reviewNote: obj.reviewNote,
        reviewedAt: obj.reviewedAt,
        reviewedBy: obj.reviewedBy,
        creatorNote: obj.creatorNote,
        createdAt: obj.createdAt,
        updatedAt: obj.createdAt,
      })
      await repo.upsert(ep)
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
