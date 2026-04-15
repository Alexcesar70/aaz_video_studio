import { describe, it, expect, vi } from 'vitest'
import {
  listReferences,
  createReference,
  deleteReference,
  uploadReference,
  type ReferenceAssetView,
} from '@/lib/referencesClient'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function sampleRef(overrides: Partial<ReferenceAssetView> = {}): ReferenceAssetView {
  return {
    id: 'r-1',
    mediaType: 'image',
    url: 'https://blob/x.png',
    source: 'upload',
    userId: 'u',
    workspaceId: 'ws',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('referencesClient.listReferences', () => {
  it('GET sem filtros', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ references: [sampleRef()] }),
    )
    const list = await listReferences({ fetchImpl: fetchImpl as unknown as typeof fetch })
    expect(list).toHaveLength(1)
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/references',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('passa mediaType, source, scope, limit como query params', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ references: [] }))
    await listReferences({
      mediaType: 'video',
      source: 'generated',
      scope: 'workspace',
      limit: 10,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const url = fetchImpl.mock.calls[0][0] as string
    expect(url).toContain('mediaType=video')
    expect(url).toContain('source=generated')
    expect(url).toContain('scope=workspace')
    expect(url).toContain('limit=10')
  })

  it('propaga erro HTTP', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'Redis down' }, 500))
    await expect(
      listReferences({ fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(/Redis down/)
  })
})

describe('referencesClient.createReference', () => {
  it('POST com body JSON e credentials', async () => {
    const ref = sampleRef()
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ reference: ref }, 201),
    )
    const result = await createReference({
      url: 'https://blob/a.png',
      source: 'upload',
      mediaType: 'image',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toEqual(ref)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/references')
    expect((init as RequestInit).method).toBe('POST')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toEqual({
      url: 'https://blob/a.png',
      source: 'upload',
      mediaType: 'image',
    })
  })

  it('propaga erro de validação (400)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'url obrigatório' }, 400))
    await expect(
      createReference({
        url: '',
        source: 'upload',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/url obrigatório/)
  })
})

describe('referencesClient.deleteReference', () => {
  it('DELETE sem deleteBlob', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    await deleteReference('ref-1', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/references/ref-1',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('DELETE com ?deleteBlob=1', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    await deleteReference('ref-1', {
      deleteBlob: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const url = fetchImpl.mock.calls[0][0] as string
    expect(url).toBe('/api/references/ref-1?deleteBlob=1')
  })

  it('codifica id com caracteres especiais', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    await deleteReference('weird/id', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const url = fetchImpl.mock.calls[0][0] as string
    expect(url).toBe('/api/references/weird%2Fid')
  })

  it('propaga erro HTTP', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'forbidden' }, 403))
    await expect(
      deleteReference('r-1', {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/forbidden/)
  })
})

describe('referencesClient.uploadReference', () => {
  it('POST multipart/form-data com campo "file"', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        url: 'https://blob/new.png',
        pathname: 'new.png',
        referenceId: 'r-new',
      }),
    )
    const file = new File(['fake-bytes'], 'hello.png', { type: 'image/png' })
    const result = await uploadReference(file, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(result).toEqual({
      url: 'https://blob/new.png',
      pathname: 'new.png',
      referenceId: 'r-new',
    })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/blob-upload')
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).body).toBeInstanceOf(FormData)
    const form = (init as RequestInit).body as FormData
    expect(form.get('file')).toBe(file)
  })

  it('anexa mediaType ao FormData quando fornecido', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ url: 'https://blob/x', pathname: 'x' }),
    )
    const file = new File(['x'], 'x.bin', { type: 'application/octet-stream' })
    await uploadReference(file, {
      mediaType: 'video',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const form = (fetchImpl.mock.calls[0][1] as RequestInit).body as FormData
    expect(form.get('mediaType')).toBe('video')
  })

  it('propaga erro de upload', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'blob offline' }, 500))
    const file = new File(['x'], 'x.png', { type: 'image/png' })
    await expect(
      uploadReference(file, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/blob offline/)
  })
})
