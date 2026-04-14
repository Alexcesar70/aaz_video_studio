import type { ReferenceAsset } from '../domain/ReferenceAsset'
import type {
  ReferenceAssetRepository,
  ReferenceAssetListFilter,
} from '../ports/ReferenceAssetRepository'

/**
 * Lista ReferenceAssets com filtros. Pass-through para o repo —
 * mantido como use case para consistência e futuras regras
 * (ex.: redact metadata por permissão).
 */
export async function listReferenceAssets(
  deps: { repo: ReferenceAssetRepository },
  filter?: ReferenceAssetListFilter,
): Promise<ReferenceAsset[]> {
  return deps.repo.list(filter)
}
