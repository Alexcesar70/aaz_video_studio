import { describe, it, expect } from 'vitest'
import {
  validateStyleProfile,
  bumpStyleProfileVersion,
  InvalidStyleProfileError,
} from '@/modules/library'

function baseProfile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    slug: 'clay-massinha',
    name: 'Clay / Massinha',
    promptBlock: '3D clay texture with handcrafted look...',
    version: 1,
    workspaceId: null,
    isOfficial: true,
    ...overrides,
  }
}

describe('StyleProfile domain', () => {
  describe('validateStyleProfile', () => {
    it('aceita um profile mínimo válido', () => {
      const p = validateStyleProfile(baseProfile())
      expect(p.slug).toBe('clay-massinha')
      expect(p.name).toBe('Clay / Massinha')
      expect(p.isOfficial).toBe(true)
      expect(p.version).toBe(1)
      expect(p.workspaceId).toBeNull()
    })

    it('aceita slug com hífen', () => {
      expect(() =>
        validateStyleProfile(baseProfile({ slug: 'my-cool-style' })),
      ).not.toThrow()
    })

    it('rejeita slug com maiúscula', () => {
      expect(() =>
        validateStyleProfile(baseProfile({ slug: 'MyStyle' })),
      ).toThrow(/slug inválido/)
    })

    it('rejeita name vazio', () => {
      expect(() =>
        validateStyleProfile(baseProfile({ name: '   ' })),
      ).toThrow(/name é obrigatório/)
    })

    it('rejeita promptBlock vazio', () => {
      expect(() =>
        validateStyleProfile(baseProfile({ promptBlock: '' })),
      ).toThrow(/promptBlock não pode ser vazio/)
    })

    it('rejeita promptBlock enorme (>20k)', () => {
      const huge = 'x'.repeat(20_001)
      expect(() =>
        validateStyleProfile(baseProfile({ promptBlock: huge })),
      ).toThrow(/excede 20k/)
    })

    it('rejeita version < 1', () => {
      expect(() =>
        validateStyleProfile(baseProfile({ version: 0 })),
      ).toThrow(/version/)
    })

    it('rejeita isOfficial não-boolean', () => {
      expect(() =>
        validateStyleProfile(baseProfile({ isOfficial: 'true' as unknown as boolean })),
      ).toThrow(/isOfficial/)
    })

    it('rejeita referenceUrls não-array', () => {
      expect(() =>
        validateStyleProfile(
          baseProfile({ referenceUrls: 'url' as unknown as string[] }),
        ),
      ).toThrow(/referenceUrls/)
    })

    it('aceita workspaceId como string', () => {
      const p = validateStyleProfile(baseProfile({ workspaceId: 'ws-1' }))
      expect(p.workspaceId).toBe('ws-1')
    })
  })

  describe('bumpStyleProfileVersion', () => {
    it('incrementa version e preserva createdAt/isOfficial', () => {
      const v1 = validateStyleProfile(baseProfile())
      const v2 = bumpStyleProfileVersion(v1, { promptBlock: 'updated content' })
      expect(v2.version).toBe(2)
      expect(v2.promptBlock).toBe('updated content')
      expect(v2.createdAt).toBe(v1.createdAt)
      expect(v2.isOfficial).toBe(v1.isOfficial)
    })

    it('valida resultado — rejeita promptBlock vazio no bump', () => {
      const v1 = validateStyleProfile(baseProfile())
      expect(() => bumpStyleProfileVersion(v1, { promptBlock: '' })).toThrow(
        InvalidStyleProfileError,
      )
    })
  })
})
