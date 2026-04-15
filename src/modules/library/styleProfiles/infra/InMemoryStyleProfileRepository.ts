import type { StyleProfile } from '../domain/StyleProfile'
import { validateStyleProfile } from '../domain/StyleProfile'
import type { StyleProfileRepository } from '../ports/StyleProfileRepository'

export class InMemoryStyleProfileRepository implements StyleProfileRepository {
  private store = new Map<string, StyleProfile>()
  private history = new Map<string, StyleProfile[]>()

  private key(slug: string, workspaceId: string | null): string {
    return `${workspaceId ?? '__global__'}::${slug}`
  }

  async findBySlug(
    slug: string,
    workspaceId?: string | null,
  ): Promise<StyleProfile | null> {
    if (workspaceId) {
      const override = this.store.get(this.key(slug, workspaceId))
      if (override) return override
    }
    return this.store.get(this.key(slug, null)) ?? null
  }

  async findBySlugExact(
    slug: string,
    workspaceId: string | null,
  ): Promise<StyleProfile | null> {
    return this.store.get(this.key(slug, workspaceId)) ?? null
  }

  async list(filter?: {
    workspaceId?: string | null
    isOfficial?: boolean
    tag?: string
  }): Promise<StyleProfile[]> {
    const all = Array.from(this.store.values())
    return all.filter((p) => {
      if (
        filter?.workspaceId !== undefined &&
        p.workspaceId !== filter.workspaceId
      ) {
        return false
      }
      if (
        filter?.isOfficial !== undefined &&
        p.isOfficial !== filter.isOfficial
      ) {
        return false
      }
      if (filter?.tag && !(p.tags ?? []).includes(filter.tag)) return false
      return true
    })
  }

  async listVisibleTo(workspaceId: string | null): Promise<StyleProfile[]> {
    const all = Array.from(this.store.values())
    return all.filter(
      (p) => p.workspaceId === null || p.workspaceId === workspaceId,
    )
  }

  async upsert(profile: StyleProfile): Promise<StyleProfile> {
    const validated = validateStyleProfile(profile)
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

  async remove(slug: string, workspaceId: string | null): Promise<void> {
    this.store.delete(this.key(slug, workspaceId))
    // histórico é preservado propositalmente — registros imutáveis
  }

  async listVersions(
    slug: string,
    workspaceId: string | null,
  ): Promise<StyleProfile[]> {
    return this.history.get(this.key(slug, workspaceId)) ?? []
  }

  clear(): void {
    this.store.clear()
    this.history.clear()
  }
}
