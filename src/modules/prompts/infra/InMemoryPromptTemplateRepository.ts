import type { PromptTemplate, PromptTemplateKind } from '../domain/PromptTemplate'
import { validatePromptTemplate } from '../domain/PromptTemplate'
import type { PromptTemplateRepository } from '../ports/PromptTemplateRepository'

/**
 * Repository in-memory para testes unitários e dev offline.
 * NÃO usar em produção — não persiste entre restarts.
 */
export class InMemoryPromptTemplateRepository implements PromptTemplateRepository {
  private store = new Map<string, PromptTemplate>()

  private key(slug: string, workspaceId: string | null): string {
    return `${workspaceId ?? '__global__'}::${slug}`
  }

  async findBySlug(
    slug: string,
    workspaceId?: string | null,
  ): Promise<PromptTemplate | null> {
    if (workspaceId) {
      const override = this.store.get(this.key(slug, workspaceId))
      if (override) return override
    }
    return this.store.get(this.key(slug, null)) ?? null
  }

  async findBySlugExact(
    slug: string,
    workspaceId: string | null,
  ): Promise<PromptTemplate | null> {
    return this.store.get(this.key(slug, workspaceId)) ?? null
  }

  async list(filter?: {
    kind?: PromptTemplateKind
    workspaceId?: string | null
  }): Promise<PromptTemplate[]> {
    const all = Array.from(this.store.values())
    return all.filter((t) => {
      if (filter?.kind && t.kind !== filter.kind) return false
      if (filter?.workspaceId !== undefined && t.workspaceId !== filter.workspaceId) {
        return false
      }
      return true
    })
  }

  async upsert(template: PromptTemplate): Promise<PromptTemplate> {
    const validated = validatePromptTemplate(template)
    this.store.set(this.key(validated.slug, validated.workspaceId), validated)
    return validated
  }

  async remove(slug: string, workspaceId: string | null): Promise<void> {
    this.store.delete(this.key(slug, workspaceId))
  }

  /** Helper para testes: limpa o store. */
  clear(): void {
    this.store.clear()
  }
}
