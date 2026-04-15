import { describe, it, expect } from 'vitest'
import { randomUUID } from 'crypto'
import {
  validateReferenceAsset,
  inferMediaType,
  InvalidReferenceAssetError,
  REFERENCE_MEDIA_TYPES,
  REFERENCE_SOURCES,
} from '@/modules/references'

function baseRef(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: randomUUID(),
    mediaType: 'image' as const,
    url: 'https://blob.vercel-storage.com/ref-123.png',
    source: 'upload' as const,
    userId: 'user-1',
    workspaceId: 'ws-1',
    ...overrides,
  }
}

describe('ReferenceAsset domain', () => {
  describe('validateReferenceAsset', () => {
    it('aceita um ref válido minimal', () => {
      const r = validateReferenceAsset(baseRef())
      expect(r.id).toBeTruthy()
      expect(r.mediaType).toBe('image')
      expect(r.source).toBe('upload')
      expect(r.createdAt).toBeTruthy()
      expect(r.updatedAt).toBeTruthy()
    })

    it('aceita workspaceId null (jobs de sistema)', () => {
      const r = validateReferenceAsset(baseRef({ workspaceId: null }))
      expect(r.workspaceId).toBeNull()
    })

    it('rejeita id não-uuid', () => {
      expect(() => validateReferenceAsset(baseRef({ id: 'not-uuid' }))).toThrow(
        InvalidReferenceAssetError,
      )
    })

    it('rejeita mediaType inválido', () => {
      expect(() =>
        validateReferenceAsset(baseRef({ mediaType: 'foo' as unknown as string })),
      ).toThrow(/mediaType/)
    })

    it('rejeita source inválido', () => {
      expect(() =>
        validateReferenceAsset(baseRef({ source: 'x' as unknown as string })),
      ).toThrow(/source/)
    })

    it('rejeita url vazio', () => {
      expect(() => validateReferenceAsset(baseRef({ url: '' }))).toThrow(/url/)
    })

    it('rejeita url com protocolo inválido (ftp, file)', () => {
      expect(() =>
        validateReferenceAsset(baseRef({ url: 'ftp://blob/x.png' })),
      ).toThrow(/protocolo/)
      expect(() =>
        validateReferenceAsset(baseRef({ url: 'file:///tmp/x.png' })),
      ).toThrow(/protocolo/)
    })

    it('aceita http, https, blob: e data: URLs', () => {
      expect(() =>
        validateReferenceAsset(baseRef({ url: 'http://x.com/a.png' })),
      ).not.toThrow()
      expect(() =>
        validateReferenceAsset(baseRef({ url: 'blob:https://x.com/abc' })),
      ).not.toThrow()
      expect(() =>
        validateReferenceAsset(baseRef({ url: 'data:image/png;base64,xxx' })),
      ).not.toThrow()
    })

    it('rejeita userId vazio', () => {
      expect(() => validateReferenceAsset(baseRef({ userId: '' }))).toThrow(
        /userId/,
      )
    })

    it('rejeita workspaceId string vazia', () => {
      expect(() =>
        validateReferenceAsset(baseRef({ workspaceId: '' })),
      ).toThrow(/workspaceId/)
    })

    it('rejeita sizeBytes negativo', () => {
      expect(() =>
        validateReferenceAsset(baseRef({ sizeBytes: -1 })),
      ).toThrow(/sizeBytes/)
    })

    it('rejeita sizeBytes não-inteiro', () => {
      expect(() =>
        validateReferenceAsset(baseRef({ sizeBytes: 3.14 })),
      ).toThrow(/sizeBytes/)
    })

    it('rejeita sourceRef sem kind ou id', () => {
      expect(() =>
        validateReferenceAsset(baseRef({ sourceRef: { kind: 'job' } as unknown as Record<string, unknown> })),
      ).toThrow(/sourceRef/)
    })

    it('aceita sourceRef completo', () => {
      const r = validateReferenceAsset(
        baseRef({ sourceRef: { kind: 'job', id: 'j-1' } }),
      )
      expect(r.sourceRef).toEqual({ kind: 'job', id: 'j-1' })
    })

    it('preserva metadata arbitrária', () => {
      const r = validateReferenceAsset(
        baseRef({ metadata: { engineId: 'nano-banana', prompt: 'cat' } }),
      )
      expect(r.metadata).toEqual({ engineId: 'nano-banana', prompt: 'cat' })
    })
  })

  describe('inferMediaType', () => {
    it('deriva image do mime type', () => {
      expect(inferMediaType({ contentType: 'image/png' })).toBe('image')
      expect(inferMediaType({ contentType: 'image/jpeg' })).toBe('image')
    })

    it('deriva video do mime type', () => {
      expect(inferMediaType({ contentType: 'video/mp4' })).toBe('video')
    })

    it('deriva audio do mime type', () => {
      expect(inferMediaType({ contentType: 'audio/mpeg' })).toBe('audio')
    })

    it('deriva da extensão quando mime ausente', () => {
      expect(inferMediaType({ url: 'https://x.com/foo.png' })).toBe('image')
      expect(inferMediaType({ url: 'https://x.com/foo.mp4' })).toBe('video')
      expect(inferMediaType({ url: 'https://x.com/foo.mp3' })).toBe('audio')
    })

    it('ignora query string e hash ao extrair extensão', () => {
      expect(inferMediaType({ url: 'https://x.com/foo.webp?v=2#x' })).toBe(
        'image',
      )
    })

    it('retorna null quando não consegue inferir', () => {
      expect(inferMediaType({})).toBeNull()
      expect(inferMediaType({ url: 'https://x.com/foo.xyz' })).toBeNull()
      expect(inferMediaType({ contentType: 'application/json' })).toBeNull()
    })

    it('prefere contentType sobre extensão', () => {
      expect(
        inferMediaType({
          contentType: 'audio/mpeg',
          url: 'https://x.com/foo.png',
        }),
      ).toBe('audio')
    })
  })

  describe('constants', () => {
    it('REFERENCE_MEDIA_TYPES contém os 3 tipos', () => {
      expect(REFERENCE_MEDIA_TYPES).toEqual(['image', 'video', 'audio'])
    })
    it('REFERENCE_SOURCES contém as 4 origens', () => {
      expect(REFERENCE_SOURCES).toEqual([
        'upload',
        'generated',
        'asset_library',
        'external',
      ])
    })
  })
})
