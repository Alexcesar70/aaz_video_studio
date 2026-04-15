import type { Episode } from '../domain/Episode'
import type {
  EpisodeRepository,
  EpisodeListFilter,
} from '../ports/EpisodeRepository'

export class EpisodeNotFoundError extends Error {
  constructor(id: string) {
    super(`Episode not found: ${id}`)
    this.name = 'EpisodeNotFoundError'
  }
}

export async function getEpisode(
  deps: { repo: EpisodeRepository },
  id: string,
): Promise<Episode | null> {
  return deps.repo.findById(id)
}

export async function getEpisodeOrThrow(
  deps: { repo: EpisodeRepository },
  id: string,
): Promise<Episode> {
  const e = await deps.repo.findById(id)
  if (!e) throw new EpisodeNotFoundError(id)
  return e
}

export async function listEpisodes(
  deps: { repo: EpisodeRepository },
  filter?: EpisodeListFilter,
): Promise<Episode[]> {
  return deps.repo.list(filter)
}
