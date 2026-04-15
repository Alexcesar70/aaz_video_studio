import type { Episode } from '../domain/Episode'
import { validateEpisode } from '../domain/Episode'
import type {
  EpisodeRepository,
  EpisodeListFilter,
} from '../ports/EpisodeRepository'

export class InMemoryEpisodeRepository implements EpisodeRepository {
  private store = new Map<string, Episode>()

  async findById(id: string): Promise<Episode | null> {
    return this.store.get(id) ?? null
  }

  async list(filter?: EpisodeListFilter): Promise<Episode[]> {
    let items = Array.from(this.store.values())
    if (filter?.workspaceId) {
      items = items.filter((e) => e.workspaceId === filter.workspaceId)
    }
    if (filter?.projectId !== undefined) {
      items = items.filter((e) => e.projectId === filter.projectId)
    }
    if (filter?.createdBy) {
      items = items.filter((e) => e.createdBy === filter.createdBy)
    }
    if (filter?.finalStatus) {
      items = items.filter((e) => e.finalStatus === filter.finalStatus)
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (filter?.limit && filter.limit > 0) items = items.slice(0, filter.limit)
    return items
  }

  async upsert(episode: Episode): Promise<Episode> {
    const validated = validateEpisode(episode)
    this.store.set(validated.id, validated)
    return validated
  }

  async remove(id: string): Promise<void> {
    this.store.delete(id)
  }

  clear(): void {
    this.store.clear()
  }
}
