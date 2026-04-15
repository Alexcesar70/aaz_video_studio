import type { Character } from '../domain/Character'
import { validateCharacter } from '../domain/Character'
import type {
  CharacterRepository,
  CharacterListFilter,
} from '../ports/CharacterRepository'

/**
 * Repository in-memory para testes unitários e dev offline.
 * Mantém a versão corrente em `store` e o histórico em `history`
 * (map de chave → array de versões arquivadas desc).
 */
export class InMemoryCharacterRepository implements CharacterRepository {
  private store = new Map<string, Character>()
  private history = new Map<string, Character[]>()

  private key(slug: string, workspaceId: string | null): string {
    return `${workspaceId ?? '__global__'}::${slug}`
  }

  async findBySlug(
    slug: string,
    workspaceId?: string | null,
  ): Promise<Character | null> {
    if (workspaceId) {
      const override = this.store.get(this.key(slug, workspaceId))
      if (override) return override
    }
    return this.store.get(this.key(slug, null)) ?? null
  }

  async findBySlugExact(
    slug: string,
    workspaceId: string | null,
  ): Promise<Character | null> {
    return this.store.get(this.key(slug, workspaceId)) ?? null
  }

  async list(filter?: CharacterListFilter): Promise<Character[]> {
    let items = Array.from(this.store.values())
    if (filter?.workspaceId !== undefined) {
      items = items.filter((c) => c.workspaceId === filter.workspaceId)
    }
    if (filter?.isOfficial !== undefined) {
      items = items.filter((c) => c.isOfficial === filter.isOfficial)
    }
    items.sort((a, b) => {
      if (a.isOfficial && !b.isOfficial) return -1
      if (!a.isOfficial && b.isOfficial) return 1
      return b.createdAt.localeCompare(a.createdAt)
    })
    if (filter?.limit && filter.limit > 0) {
      items = items.slice(0, filter.limit)
    }
    return items
  }

  async upsert(character: Character): Promise<Character> {
    const validated = validateCharacter(character)
    const k = this.key(validated.slug, validated.workspaceId)

    const existing = this.store.get(k)
    if (existing && existing.version !== validated.version) {
      // Arquiva a versão anterior antes de sobrescrever.
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
  ): Promise<Character[]> {
    return this.history.get(this.key(slug, workspaceId)) ?? []
  }

  /** Helper para testes. */
  clear(): void {
    this.store.clear()
    this.history.clear()
  }
}
