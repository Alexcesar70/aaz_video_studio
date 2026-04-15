import type { Playbook } from '../domain/Playbook'
import { validatePlaybook } from '../domain/Playbook'
import type {
  PlaybookRepository,
  PlaybookListFilter,
} from '../ports/PlaybookRepository'

/**
 * Repository in-memory para testes. Mantém histórico por (workspaceId, slug).
 */
export class InMemoryPlaybookRepository implements PlaybookRepository {
  private store = new Map<string, Playbook>()
  private history = new Map<string, Playbook[]>()

  private key(slug: string, workspaceId: string): string {
    return `${workspaceId}::${slug}`
  }

  async findBySlug(
    slug: string,
    workspaceId: string,
  ): Promise<Playbook | null> {
    return this.store.get(this.key(slug, workspaceId)) ?? null
  }

  async list(filter?: PlaybookListFilter): Promise<Playbook[]> {
    let items = Array.from(this.store.values())
    if (filter?.workspaceId) {
      items = items.filter((p) => p.workspaceId === filter.workspaceId)
    }
    if (filter?.isOfficial !== undefined) {
      items = items.filter((p) => p.isOfficial === filter.isOfficial)
    }
    if (filter?.createdBy) {
      items = items.filter((p) => p.createdBy === filter.createdBy)
    }
    items.sort((a, b) => {
      if (a.isOfficial && !b.isOfficial) return -1
      if (!a.isOfficial && b.isOfficial) return 1
      return b.createdAt.localeCompare(a.createdAt)
    })
    if (filter?.limit && filter.limit > 0) items = items.slice(0, filter.limit)
    return items
  }

  async upsert(playbook: Playbook): Promise<Playbook> {
    const validated = validatePlaybook(playbook)
    const k = this.key(validated.slug, validated.workspaceId)

    const existing = this.store.get(k)
    if (existing && existing.version !== validated.version) {
      const versions = this.history.get(k) ?? []
      versions.unshift(existing)
      this.history.set(k, versions)
    }
    this.store.set(k, validated)
    return validated
  }

  async remove(slug: string, workspaceId: string): Promise<void> {
    this.store.delete(this.key(slug, workspaceId))
    // histórico preservado
  }

  async listVersions(
    slug: string,
    workspaceId: string,
  ): Promise<Playbook[]> {
    return this.history.get(this.key(slug, workspaceId)) ?? []
  }

  clear(): void {
    this.store.clear()
    this.history.clear()
  }
}
