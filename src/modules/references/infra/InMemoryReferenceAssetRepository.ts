import type { ReferenceAsset } from '../domain/ReferenceAsset'
import { validateReferenceAsset } from '../domain/ReferenceAsset'
import type {
  ReferenceAssetRepository,
  ReferenceAssetListFilter,
} from '../ports/ReferenceAssetRepository'

/**
 * Repository in-memory para testes unitários e dev offline.
 * NÃO usar em produção.
 */
export class InMemoryReferenceAssetRepository
  implements ReferenceAssetRepository
{
  private store = new Map<string, ReferenceAsset>()

  async findById(id: string): Promise<ReferenceAsset | null> {
    return this.store.get(id) ?? null
  }

  async list(
    filter?: ReferenceAssetListFilter,
  ): Promise<ReferenceAsset[]> {
    let items = Array.from(this.store.values())

    if (filter?.userId) {
      items = items.filter((r) => r.userId === filter.userId)
    }
    if (filter?.workspaceId !== undefined) {
      items = items.filter((r) => r.workspaceId === filter.workspaceId)
    }
    if (filter?.mediaType) {
      items = items.filter((r) => r.mediaType === filter.mediaType)
    }
    if (filter?.source) {
      items = items.filter((r) => r.source === filter.source)
    }
    if (filter?.since) {
      items = items.filter((r) => r.createdAt >= filter.since!)
    }

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    if (filter?.limit && filter.limit > 0) {
      items = items.slice(0, filter.limit)
    }
    return items
  }

  async upsert(asset: ReferenceAsset): Promise<ReferenceAsset> {
    const validated = validateReferenceAsset(asset)
    this.store.set(validated.id, validated)
    return validated
  }

  async remove(id: string): Promise<void> {
    this.store.delete(id)
  }

  /** Helper para testes. */
  clear(): void {
    this.store.clear()
  }

  size(): number {
    return this.store.size
  }
}
