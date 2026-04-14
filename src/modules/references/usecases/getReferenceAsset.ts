import type { ReferenceAsset } from '../domain/ReferenceAsset'
import type { ReferenceAssetRepository } from '../ports/ReferenceAssetRepository'

export class ReferenceAssetNotFoundError extends Error {
  constructor(id: string) {
    super(`ReferenceAsset not found: ${id}`)
    this.name = 'ReferenceAssetNotFoundError'
  }
}

export class ReferenceAssetAccessDeniedError extends Error {
  constructor(id: string) {
    super(`Access denied to ReferenceAsset: ${id}`)
    this.name = 'ReferenceAssetAccessDeniedError'
  }
}

export interface GetReferenceAssetInput {
  id: string
  /** Valida que o asset pertence a este user. */
  requesterUserId?: string
  /** Valida que o asset pertence a este workspace (fallback ao user check). */
  requesterWorkspaceId?: string | null
}

/**
 * Busca um ReferenceAsset aplicando autorização opcional.
 * Lança ReferenceAssetNotFoundError ou ReferenceAssetAccessDeniedError.
 */
export async function getReferenceAsset(
  deps: { repo: ReferenceAssetRepository },
  input: GetReferenceAssetInput,
): Promise<ReferenceAsset> {
  const asset = await deps.repo.findById(input.id)
  if (!asset) throw new ReferenceAssetNotFoundError(input.id)

  if (input.requesterUserId && asset.userId !== input.requesterUserId) {
    if (
      input.requesterWorkspaceId === undefined ||
      input.requesterWorkspaceId !== asset.workspaceId
    ) {
      throw new ReferenceAssetAccessDeniedError(input.id)
    }
  }
  return asset
}
