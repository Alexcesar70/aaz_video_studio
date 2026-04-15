import { randomUUID } from 'crypto'
import type {
  ReferenceAsset,
  ReferenceMediaType,
  ReferenceSource,
  ReferenceSourceRef,
} from '../domain/ReferenceAsset'
import {
  validateReferenceAsset,
  inferMediaType,
} from '../domain/ReferenceAsset'
import type { ReferenceAssetRepository } from '../ports/ReferenceAssetRepository'

export interface CreateReferenceAssetInput {
  url: string
  /**
   * Se omitido, tenta inferir via `contentType` ou extensão do URL.
   * Se a inferência falhar, lança `InvalidReferenceAssetError`.
   */
  mediaType?: ReferenceMediaType
  source: ReferenceSource
  sourceRef?: ReferenceSourceRef
  pathname?: string
  contentType?: string
  sizeBytes?: number
  userId: string
  workspaceId: string | null
  metadata?: Record<string, unknown>
  /** Se fornecido, usa este id (para idempotência/retry). */
  id?: string
}

/**
 * Cria um ReferenceAsset, persistindo no repositório.
 *
 * Não faz upload — assume que o URL já está acessível (tipicamente
 * porque um POST prévio em /api/blob-upload já subiu o arquivo). Essa
 * separação preserva single-responsibility: este use case é sobre
 * MODELAR a referência, não sobre transferir bytes.
 */
export async function createReferenceAsset(
  deps: { repo: ReferenceAssetRepository },
  input: CreateReferenceAssetInput,
): Promise<ReferenceAsset> {
  const mediaType =
    input.mediaType ??
    inferMediaType({
      contentType: input.contentType,
      url: input.url,
    }) ??
    undefined

  const now = new Date().toISOString()
  const asset = validateReferenceAsset({
    id: input.id ?? randomUUID(),
    mediaType,
    url: input.url,
    pathname: input.pathname,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    source: input.source,
    sourceRef: input.sourceRef,
    userId: input.userId,
    workspaceId: input.workspaceId,
    metadata: input.metadata,
    createdAt: now,
    updatedAt: now,
  })

  return deps.repo.upsert(asset)
}
