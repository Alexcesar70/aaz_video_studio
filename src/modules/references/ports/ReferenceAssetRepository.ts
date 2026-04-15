import type {
  ReferenceAsset,
  ReferenceMediaType,
  ReferenceSource,
} from '../domain/ReferenceAsset'

/**
 * Contrato de persistência de ReferenceAsset.
 *
 * Implementações:
 *   - infra/RedisReferenceAssetRepository (produção)
 *   - infra/InMemoryReferenceAssetRepository (testes + dev offline)
 */
export interface ReferenceAssetListFilter {
  userId?: string
  workspaceId?: string | null
  mediaType?: ReferenceMediaType
  source?: ReferenceSource
  /** Retorna apenas assets criados após esta data ISO 8601. */
  since?: string
  /** Limite de resultados. Default: 50. */
  limit?: number
}

export interface ReferenceAssetRepository {
  findById(id: string): Promise<ReferenceAsset | null>

  /** Lista com filtros. Ordenação: mais recente primeiro. */
  list(filter?: ReferenceAssetListFilter): Promise<ReferenceAsset[]>

  upsert(asset: ReferenceAsset): Promise<ReferenceAsset>

  remove(id: string): Promise<void>
}
