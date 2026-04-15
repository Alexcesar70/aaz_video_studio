/**
 * Client-side helpers para consumir /api/references do browser.
 *
 * Mantido puro — sem hooks React, sem state management. Quem quiser
 * usar em componente React passa as funções para useEffect/useState.
 *
 * O shape do retorno é uma projeção de `ReferenceAsset` do módulo
 * `@/modules/references`, intencionalmente duplicada aqui para que
 * este arquivo possa ser importado em código client sem pegar nada
 * de infra server-side pelo efeito colateral das cadeias de imports.
 */

export type ReferenceMediaType = 'image' | 'video' | 'audio'

export type ReferenceSource =
  | 'upload'
  | 'generated'
  | 'asset_library'
  | 'external'

export interface ReferenceAssetView {
  id: string
  mediaType: ReferenceMediaType
  url: string
  pathname?: string
  contentType?: string
  sizeBytes?: number
  source: ReferenceSource
  sourceRef?: { kind: string; id: string }
  userId: string
  workspaceId: string | null
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ListReferencesOptions {
  mediaType?: ReferenceMediaType
  source?: ReferenceSource
  scope?: 'me' | 'workspace'
  limit?: number
  fetchImpl?: typeof fetch
}

export async function listReferences(
  options: ListReferencesOptions = {},
): Promise<ReferenceAssetView[]> {
  const fetchFn = options.fetchImpl ?? fetch
  const params = new URLSearchParams()
  if (options.mediaType) params.set('mediaType', options.mediaType)
  if (options.source) params.set('source', options.source)
  if (options.scope) params.set('scope', options.scope)
  if (options.limit) params.set('limit', String(options.limit))

  const qs = params.toString()
  const res = await fetchFn(`/api/references${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error ?? `Falha ao listar references: HTTP ${res.status}`)
  }
  const data = (await res.json()) as { references: ReferenceAssetView[] }
  return data.references
}

export interface CreateReferenceInput {
  url: string
  mediaType?: ReferenceMediaType
  source: ReferenceSource
  pathname?: string
  contentType?: string
  sizeBytes?: number
  sourceRef?: { kind: string; id: string }
  metadata?: Record<string, unknown>
  fetchImpl?: typeof fetch
}

export async function createReference(
  input: CreateReferenceInput,
): Promise<ReferenceAssetView> {
  const fetchFn = input.fetchImpl ?? fetch
  const { fetchImpl: _drop, ...body } = input
  void _drop
  const res = await fetchFn('/api/references', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error ?? `Falha ao criar reference: HTTP ${res.status}`)
  }
  const data = (await res.json()) as { reference: ReferenceAssetView }
  return data.reference
}

export interface DeleteReferenceOptions {
  deleteBlob?: boolean
  fetchImpl?: typeof fetch
}

export async function deleteReference(
  id: string,
  options: DeleteReferenceOptions = {},
): Promise<void> {
  const fetchFn = options.fetchImpl ?? fetch
  const qs = options.deleteBlob ? '?deleteBlob=1' : ''
  const res = await fetchFn(`/api/references/${encodeURIComponent(id)}${qs}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      err?.error ?? `Falha ao remover reference: HTTP ${res.status}`,
    )
  }
}

/**
 * Helper de alto nível: faz upload via /api/blob-upload e retorna
 * ao mesmo tempo a URL e o referenceId (se a flag USE_REFERENCE_ASSETS
 * estiver ligada no backend). Consolidar esse fluxo em um único call
 * site elimina pegadinhas de ordem de chamada em componentes React.
 */
export interface UploadReferenceResult {
  url: string
  pathname: string
  referenceId?: string
}

export async function uploadReference(
  file: File,
  options: { mediaType?: ReferenceMediaType; fetchImpl?: typeof fetch } = {},
): Promise<UploadReferenceResult> {
  const fetchFn = options.fetchImpl ?? fetch
  const form = new FormData()
  form.append('file', file)
  if (options.mediaType) form.append('mediaType', options.mediaType)

  const res = await fetchFn('/api/blob-upload', {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error ?? `Upload falhou: HTTP ${res.status}`)
  }
  return (await res.json()) as UploadReferenceResult
}
