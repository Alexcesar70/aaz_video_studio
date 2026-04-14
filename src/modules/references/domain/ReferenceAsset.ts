/**
 * ReferenceAsset — entidade de domínio que representa uma mídia (imagem,
 * vídeo, áudio) usada como **entrada** para uma geração.
 *
 * Diferente de `Asset` (library — characters/scenarios/items): um
 * ReferenceAsset é o URL concreto de um arquivo, tipicamente hospedado
 * no Vercel Blob, pronto para ser passado como `reference_images`,
 * `first_frame_url`, `reference_videos`, etc.
 *
 * Origens possíveis (`source`):
 *   - 'upload'         — usuário enviou via /api/blob-upload
 *   - 'generated'      — output de um Job anterior (video/image/music/voice)
 *   - 'asset_library'  — URL copiado de um Asset do módulo `library`
 *   - 'external'       — URL colado externo (futuro: podemos rejeitar por
 *                        segurança, mas hoje é permitido)
 *
 * `sourceRef` é um ponteiro opcional de procedência: `{ kind: 'job', id }`
 * ou `{ kind: 'asset', id }` — útil para rastrear "de onde veio" e para
 * deduplicação.
 *
 * Regras invariantes:
 *   - id é uuid v4.
 *   - mediaType ∈ REFERENCE_MEDIA_TYPES.
 *   - url é string não-vazia (validação leve — aceita http(s) ou blob:).
 *   - userId é obrigatório (jobs de sistema criam com userId='system').
 *   - workspaceId é string ou null.
 *   - size, quando presente, é inteiro >= 0.
 *
 * Este módulo é **puro**: sem I/O, sem imports de infra.
 */

export type ReferenceMediaType = 'image' | 'video' | 'audio'

export const REFERENCE_MEDIA_TYPES: readonly ReferenceMediaType[] = [
  'image',
  'video',
  'audio',
] as const

export type ReferenceSource =
  | 'upload'
  | 'generated'
  | 'asset_library'
  | 'external'

export const REFERENCE_SOURCES: readonly ReferenceSource[] = [
  'upload',
  'generated',
  'asset_library',
  'external',
] as const

export interface ReferenceSourceRef {
  /** Tipo da entidade originária. */
  kind: 'job' | 'asset' | 'scene' | 'episode'
  /** Id da entidade. */
  id: string
}

export interface ReferenceAsset {
  id: string
  mediaType: ReferenceMediaType
  /** URL público (Vercel Blob). */
  url: string
  /** Pathname dentro do Blob — necessário para deletar a mídia associada. */
  pathname?: string
  /** MIME type (image/png, video/mp4, audio/mpeg, ...). */
  contentType?: string
  /** Tamanho em bytes, quando conhecido. */
  sizeBytes?: number
  source: ReferenceSource
  sourceRef?: ReferenceSourceRef
  userId: string
  workspaceId: string | null
  /** Metadata arbitrária (ex.: prompt usado, engineId, duration). */
  metadata?: Record<string, unknown>
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

export class InvalidReferenceAssetError extends Error {
  constructor(message: string) {
    super(`Invalid ReferenceAsset: ${message}`)
    this.name = 'InvalidReferenceAssetError'
  }
}

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const URL_PROTOCOL_REGEX = /^(https?:|blob:|data:)/i

/**
 * Valida shape mínimo de um ReferenceAsset antes de persistir.
 * Lança `InvalidReferenceAssetError` em qualquer infração.
 */
export function validateReferenceAsset(
  input: Partial<ReferenceAsset>,
): ReferenceAsset {
  if (!input.id || typeof input.id !== 'string') {
    throw new InvalidReferenceAssetError('id é obrigatório')
  }
  if (!UUID_V4_REGEX.test(input.id)) {
    throw new InvalidReferenceAssetError(
      `id inválido "${input.id}" — deve ser uuid v4`,
    )
  }
  if (!input.mediaType || !REFERENCE_MEDIA_TYPES.includes(input.mediaType)) {
    throw new InvalidReferenceAssetError(
      `mediaType inválido: ${String(input.mediaType)}`,
    )
  }
  if (typeof input.url !== 'string' || input.url.trim().length === 0) {
    throw new InvalidReferenceAssetError('url é obrigatório')
  }
  if (!URL_PROTOCOL_REGEX.test(input.url)) {
    throw new InvalidReferenceAssetError(
      `url com protocolo inválido: ${input.url.slice(0, 40)}`,
    )
  }
  if (!input.source || !REFERENCE_SOURCES.includes(input.source)) {
    throw new InvalidReferenceAssetError(`source inválido: ${String(input.source)}`)
  }
  if (typeof input.userId !== 'string' || input.userId.length === 0) {
    throw new InvalidReferenceAssetError('userId é obrigatório')
  }
  if (
    input.workspaceId !== null &&
    (typeof input.workspaceId !== 'string' || input.workspaceId.length === 0)
  ) {
    throw new InvalidReferenceAssetError('workspaceId deve ser string ou null')
  }
  if (
    input.sizeBytes !== undefined &&
    (typeof input.sizeBytes !== 'number' ||
      input.sizeBytes < 0 ||
      !Number.isInteger(input.sizeBytes))
  ) {
    throw new InvalidReferenceAssetError('sizeBytes deve ser inteiro >= 0')
  }
  if (input.sourceRef !== undefined) {
    const ref = input.sourceRef
    if (!ref.kind || !ref.id) {
      throw new InvalidReferenceAssetError('sourceRef requer kind e id')
    }
  }

  const now = new Date().toISOString()
  return {
    id: input.id,
    mediaType: input.mediaType,
    url: input.url,
    pathname: input.pathname,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    source: input.source,
    sourceRef: input.sourceRef,
    userId: input.userId,
    workspaceId: input.workspaceId,
    metadata: input.metadata,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  }
}

/**
 * Heurística de inferência de mediaType a partir do contentType (MIME)
 * ou da extensão do URL. Pura — sem fetch.
 *
 * Retorna null se não conseguir inferir.
 */
export function inferMediaType(hints: {
  contentType?: string
  url?: string
}): ReferenceMediaType | null {
  const mime = hints.contentType?.toLowerCase() ?? ''
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'

  const url = hints.url?.toLowerCase() ?? ''
  const ext = url.split('?')[0].split('#')[0].split('.').pop() ?? ''
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp'].includes(ext)) {
    return 'image'
  }
  if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) return 'audio'
  return null
}
