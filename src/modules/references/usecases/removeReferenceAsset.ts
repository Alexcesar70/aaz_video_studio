import type { ReferenceAssetRepository } from '../ports/ReferenceAssetRepository'
import {
  getReferenceAsset,
  ReferenceAssetAccessDeniedError,
  ReferenceAssetNotFoundError,
} from './getReferenceAsset'

/**
 * Port opcional para deleção do blob físico. Não é obrigatório —
 * se ausente, o use case apenas remove o registro do repositório.
 *
 * Implementação tipicamente envolve `@vercel/blob#del(pathname)`.
 */
export interface BlobDeleter {
  delete(pathname: string): Promise<void>
}

export interface RemoveReferenceAssetInput {
  id: string
  /** Autoriza por user (se fornecido). */
  requesterUserId?: string
  requesterWorkspaceId?: string | null
  /**
   * Se true e o asset tem `pathname`, também chama `blobDeleter.delete()`.
   * Sem `blobDeleter` nos deps, este flag é ignorado.
   */
  deleteBlob?: boolean
}

export async function removeReferenceAsset(
  deps: {
    repo: ReferenceAssetRepository
    blobDeleter?: BlobDeleter
  },
  input: RemoveReferenceAssetInput,
): Promise<void> {
  // getReferenceAsset já aplica autorização e lança NotFound/AccessDenied.
  const asset = await getReferenceAsset(
    { repo: deps.repo },
    {
      id: input.id,
      requesterUserId: input.requesterUserId,
      requesterWorkspaceId: input.requesterWorkspaceId,
    },
  )

  await deps.repo.remove(asset.id)

  if (input.deleteBlob && asset.pathname && deps.blobDeleter) {
    await deps.blobDeleter.delete(asset.pathname).catch((err) => {
      // Não propaga — registro já foi removido. Blob órfão é problema
      // menor que bloquear a deleção do registro.
      console.error('[removeReferenceAsset] blob delete failed', {
        id: asset.id,
        pathname: asset.pathname,
        err,
      })
    })
  }
}

// Re-exporta erros úteis para handlers HTTP.
export { ReferenceAssetNotFoundError, ReferenceAssetAccessDeniedError }
