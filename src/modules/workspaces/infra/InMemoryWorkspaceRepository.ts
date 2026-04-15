import type { Workspace } from '../domain/Workspace'
import type {
  WorkspaceRepository,
  WorkspaceListFilter,
} from '../ports/WorkspaceRepository'

/**
 * Repository in-memory para testes. Mantém índice secundário por slug,
 * espelhando a unique constraint do Postgres.
 */
export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  private byId = new Map<string, Workspace>()
  private slugIndex = new Map<string, string>() // slug → id

  async findById(id: string): Promise<Workspace | null> {
    return this.byId.get(id) ?? null
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    const id = this.slugIndex.get(slug)
    if (!id) return null
    return this.byId.get(id) ?? null
  }

  async list(filter?: WorkspaceListFilter): Promise<Workspace[]> {
    let items = Array.from(this.byId.values())
    if (filter?.status) items = items.filter((w) => w.status === filter.status)
    if (filter?.ownerId) items = items.filter((w) => w.ownerId === filter.ownerId)
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (filter?.limit && filter.limit > 0) items = items.slice(0, filter.limit)
    return items
  }

  async upsert(ws: Workspace): Promise<Workspace> {
    const existingBySlug = this.slugIndex.get(ws.slug)
    if (existingBySlug && existingBySlug !== ws.id) {
      throw new Error(
        `Slug ${ws.slug} já pertence ao workspace ${existingBySlug}`,
      )
    }
    // Se slug mudou, limpa o anterior
    const prev = this.byId.get(ws.id)
    if (prev && prev.slug !== ws.slug) {
      this.slugIndex.delete(prev.slug)
    }
    this.byId.set(ws.id, ws)
    this.slugIndex.set(ws.slug, ws.id)
    return ws
  }

  async remove(id: string): Promise<void> {
    const prev = this.byId.get(id)
    if (prev) this.slugIndex.delete(prev.slug)
    this.byId.delete(id)
  }

  clear(): void {
    this.byId.clear()
    this.slugIndex.clear()
  }

  size(): number {
    return this.byId.size
  }
}
