import type { Episode, EpisodeFinalStatus } from '../domain/Episode'

export interface EpisodeListFilter {
  workspaceId?: string
  /** undefined = qualquer; null = só avulsos (projectId NULL); string = de um projeto específico. */
  projectId?: string | null
  createdBy?: string
  finalStatus?: EpisodeFinalStatus
  limit?: number
}

export interface EpisodeRepository {
  findById(id: string): Promise<Episode | null>
  list(filter?: EpisodeListFilter): Promise<Episode[]>
  upsert(episode: Episode): Promise<Episode>
  remove(id: string): Promise<void>
}
