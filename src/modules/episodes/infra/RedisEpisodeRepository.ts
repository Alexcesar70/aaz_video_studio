/**
 * RedisEpisodeRepository — adapter para chaves legadas `aaz:ep:*`.
 *
 * Mesmas regras do RedisProjectRepository:
 *   - `organizationId` ausente → `workspaceId = LEGACY_WORKSPACE_ID`.
 *   - Mantém shape do JSON legado (`finalVideoSizeMB` capital MB,
 *     `organizationId` opcional) intocado para retrocompat.
 */

import { getRedis } from '@/lib/redis'
import type {
  Episode,
  EpisodeFinalStatus,
} from '../domain/Episode'
import { validateEpisode } from '../domain/Episode'
import type {
  EpisodeRepository,
  EpisodeListFilter,
} from '../ports/EpisodeRepository'

const PREFIX = 'aaz:ep:'
export const LEGACY_WORKSPACE_ID = '__legacy__'

interface LegacyShape {
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
  updatedAt?: string
}

function fromRedis(raw: string): Episode | null {
  try {
    const obj = JSON.parse(raw) as LegacyShape
    return validateEpisode({
      id: obj.id,
      name: obj.name,
      workspaceId: obj.organizationId ?? LEGACY_WORKSPACE_ID,
      projectId: obj.projectId ?? null,
      createdBy: obj.createdBy ?? 'system',
      finalVideoUrl: obj.finalVideoUrl,
      finalVideoSizeMb: obj.finalVideoSizeMB,
      finalVideoUploadedAt: obj.finalVideoUploadedAt,
      finalVideoUploadedBy: obj.finalVideoUploadedBy,
      finalStatus: obj.finalStatus ?? 'none',
      reviewNote: obj.reviewNote,
      reviewedAt: obj.reviewedAt,
      reviewedBy: obj.reviewedBy,
      creatorNote: obj.creatorNote,
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt ?? obj.createdAt,
    })
  } catch {
    return null
  }
}

function toRedis(ep: Episode): string {
  const legacy: LegacyShape = {
    id: ep.id,
    name: ep.name,
    projectId: ep.projectId,
    createdAt: ep.createdAt,
    createdBy: ep.createdBy,
    finalVideoUrl: ep.finalVideoUrl,
    finalVideoSizeMB: ep.finalVideoSizeMb,
    finalVideoUploadedAt: ep.finalVideoUploadedAt,
    finalVideoUploadedBy: ep.finalVideoUploadedBy,
    finalStatus: ep.finalStatus,
    reviewNote: ep.reviewNote,
    reviewedAt: ep.reviewedAt,
    reviewedBy: ep.reviewedBy,
    creatorNote: ep.creatorNote,
  }
  if (ep.workspaceId !== LEGACY_WORKSPACE_ID) {
    legacy.organizationId = ep.workspaceId
  }
  if (ep.updatedAt && ep.updatedAt !== ep.createdAt) {
    legacy.updatedAt = ep.updatedAt
  }
  return JSON.stringify(legacy)
}

export class RedisEpisodeRepository implements EpisodeRepository {
  async findById(id: string): Promise<Episode | null> {
    const redis = await getRedis()
    const raw = await redis.get(`${PREFIX}${id}`)
    return raw ? fromRedis(raw) : null
  }

  async list(filter?: EpisodeListFilter): Promise<Episode[]> {
    const redis = await getRedis()
    const keys = await redis.keys(`${PREFIX}*`)
    const items: Episode[] = []
    for (const key of keys) {
      const raw = await redis.get(key)
      if (!raw) continue
      const e = fromRedis(raw)
      if (!e) continue
      if (filter?.workspaceId && e.workspaceId !== filter.workspaceId) continue
      if (filter?.projectId !== undefined && e.projectId !== filter.projectId) continue
      if (filter?.createdBy && e.createdBy !== filter.createdBy) continue
      if (filter?.finalStatus && e.finalStatus !== filter.finalStatus) continue
      items.push(e)
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (filter?.limit && filter.limit > 0) return items.slice(0, filter.limit)
    return items
  }

  async upsert(episode: Episode): Promise<Episode> {
    const validated = validateEpisode(episode)
    const redis = await getRedis()
    await redis.set(`${PREFIX}${validated.id}`, toRedis(validated))
    return validated
  }

  async remove(id: string): Promise<void> {
    const redis = await getRedis()
    await redis.del(`${PREFIX}${id}`)
  }
}
