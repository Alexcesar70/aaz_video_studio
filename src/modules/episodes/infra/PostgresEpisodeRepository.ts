import { eq, desc, and, isNull, type SQL } from 'drizzle-orm'
import type { Episode, EpisodeFinalStatus } from '../domain/Episode'
import { validateEpisode } from '../domain/Episode'
import type {
  EpisodeRepository,
  EpisodeListFilter,
} from '../ports/EpisodeRepository'
import { getDb, type Db } from '@/db/client'
import { episodes, type EpisodeRow, type EpisodeInsert } from '@/db/schema'

export class PostgresEpisodeRepository implements EpisodeRepository {
  private readonly db: Db

  constructor(db?: Db) {
    this.db = db ?? getDb()
  }

  async findById(id: string): Promise<Episode | null> {
    const rows = await this.db
      .select()
      .from(episodes)
      .where(eq(episodes.id, id))
      .limit(1)
    return rows[0] ? rowToEpisode(rows[0]) : null
  }

  async list(filter?: EpisodeListFilter): Promise<Episode[]> {
    const conds: SQL[] = []
    if (filter?.workspaceId) {
      conds.push(eq(episodes.workspaceId, filter.workspaceId))
    }
    if (filter?.projectId === null) {
      conds.push(isNull(episodes.projectId))
    } else if (typeof filter?.projectId === 'string') {
      conds.push(eq(episodes.projectId, filter.projectId))
    }
    if (filter?.createdBy) {
      conds.push(eq(episodes.createdBy, filter.createdBy))
    }
    if (filter?.finalStatus) {
      conds.push(eq(episodes.finalStatus, filter.finalStatus))
    }

    const base = this.db.select().from(episodes).orderBy(desc(episodes.createdAt))
    const q = conds.length > 0 ? base.where(and(...conds)!) : base
    const limited = filter?.limit && filter.limit > 0 ? q.limit(filter.limit) : q

    const rows = await limited
    return rows.map(rowToEpisode)
  }

  async upsert(episode: Episode): Promise<Episode> {
    const validated = validateEpisode(episode)
    const insert = episodeToInsert(validated)
    const updateSet: Partial<EpisodeInsert> = {
      name: insert.name,
      workspaceId: insert.workspaceId,
      projectId: insert.projectId,
      createdBy: insert.createdBy,
      finalVideoUrl: insert.finalVideoUrl,
      finalVideoSizeMb: insert.finalVideoSizeMb,
      finalVideoUploadedAt: insert.finalVideoUploadedAt,
      finalVideoUploadedBy: insert.finalVideoUploadedBy,
      finalStatus: insert.finalStatus,
      reviewNote: insert.reviewNote,
      reviewedAt: insert.reviewedAt,
      reviewedBy: insert.reviewedBy,
      creatorNote: insert.creatorNote,
      updatedAt: insert.updatedAt,
    }
    await this.db
      .insert(episodes)
      .values(insert)
      .onConflictDoUpdate({ target: episodes.id, set: updateSet })
    return validated
  }

  async remove(id: string): Promise<void> {
    await this.db.delete(episodes).where(eq(episodes.id, id))
  }
}

export function rowToEpisode(row: EpisodeRow): Episode {
  return validateEpisode({
    id: row.id,
    name: row.name,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    createdBy: row.createdBy,
    finalVideoUrl: row.finalVideoUrl ?? undefined,
    finalVideoSizeMb:
      row.finalVideoSizeMb !== null
        ? Number(row.finalVideoSizeMb)
        : undefined,
    finalVideoUploadedAt: row.finalVideoUploadedAt?.toISOString(),
    finalVideoUploadedBy: row.finalVideoUploadedBy ?? undefined,
    finalStatus: row.finalStatus as EpisodeFinalStatus,
    reviewNote: row.reviewNote ?? undefined,
    reviewedAt: row.reviewedAt?.toISOString(),
    reviewedBy: row.reviewedBy ?? undefined,
    creatorNote: row.creatorNote ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })
}

export function episodeToInsert(ep: Episode): EpisodeInsert {
  return {
    id: ep.id,
    name: ep.name,
    workspaceId: ep.workspaceId,
    projectId: ep.projectId,
    createdBy: ep.createdBy,
    finalVideoUrl: ep.finalVideoUrl ?? null,
    finalVideoSizeMb:
      ep.finalVideoSizeMb !== undefined ? String(ep.finalVideoSizeMb) : null,
    finalVideoUploadedAt: ep.finalVideoUploadedAt
      ? new Date(ep.finalVideoUploadedAt)
      : null,
    finalVideoUploadedBy: ep.finalVideoUploadedBy ?? null,
    finalStatus: ep.finalStatus,
    reviewNote: ep.reviewNote ?? null,
    reviewedAt: ep.reviewedAt ? new Date(ep.reviewedAt) : null,
    reviewedBy: ep.reviewedBy ?? null,
    creatorNote: ep.creatorNote ?? null,
    createdAt: new Date(ep.createdAt),
    updatedAt: new Date(ep.updatedAt),
  }
}
