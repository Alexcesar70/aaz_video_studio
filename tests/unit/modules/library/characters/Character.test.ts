import { describe, it, expect } from 'vitest'
import {
  validateCharacter,
  bumpCharacterVersion,
  forkCharacter,
  InvalidCharacterError,
} from '@/modules/library'

function baseChar(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    slug: 'abraao',
    name: 'Abraão',
    imageUrls: ['https://blob/abraao-1.png'],
    workspaceId: null,
    isOfficial: true,
    version: 1,
    ...overrides,
  }
}

describe('Character domain', () => {
  describe('validateCharacter', () => {
    it('aceita um character válido minimal', () => {
      const c = validateCharacter(baseChar())
      expect(c.slug).toBe('abraao')
      expect(c.name).toBe('Abraão')
      expect(c.version).toBe(1)
      expect(c.isOfficial).toBe(true)
    })

    it('rejeita slug inválido (letras maiúsculas)', () => {
      expect(() => validateCharacter(baseChar({ slug: 'Abraao' }))).toThrow(
        /slug inválido/,
      )
    })

    it('aceita slug com hífen e underscore', () => {
      expect(() =>
        validateCharacter(baseChar({ slug: 'jesus_menino-v2' })),
      ).not.toThrow()
    })

    it('rejeita name vazio', () => {
      expect(() => validateCharacter(baseChar({ name: '  ' }))).toThrow(/name/)
    })

    it('rejeita imageUrls não-array', () => {
      expect(() =>
        validateCharacter(baseChar({ imageUrls: 'not-array' as unknown as string })),
      ).toThrow(/imageUrls/)
    })

    it('aceita imageUrls vazio (pode ser character ainda sem arte)', () => {
      expect(() => validateCharacter(baseChar({ imageUrls: [] }))).not.toThrow()
    })

    it('rejeita promptBlock absurdo (>20k chars)', () => {
      expect(() =>
        validateCharacter(baseChar({ promptBlock: 'x'.repeat(20_001) })),
      ).toThrow(/20k/)
    })

    it('rejeita version < 1', () => {
      expect(() => validateCharacter(baseChar({ version: 0 }))).toThrow(/version/)
    })

    it('rejeita version não-inteiro', () => {
      expect(() => validateCharacter(baseChar({ version: 1.5 }))).toThrow(/version/)
    })

    it('aceita workspaceId null ou string', () => {
      expect(validateCharacter(baseChar({ workspaceId: null })).workspaceId).toBeNull()
      expect(
        validateCharacter(baseChar({ workspaceId: 'ws-1' })).workspaceId,
      ).toBe('ws-1')
    })

    it('rejeita workspaceId string vazia', () => {
      expect(() =>
        validateCharacter(baseChar({ workspaceId: '' })),
      ).toThrow(/workspaceId/)
    })

    it('rejeita isOfficial não-boolean', () => {
      expect(() =>
        validateCharacter(baseChar({ isOfficial: 'yes' as unknown as boolean })),
      ).toThrow(/isOfficial/)
    })

    it('name é trimmed', () => {
      const c = validateCharacter(baseChar({ name: '  Abraão  ' }))
      expect(c.name).toBe('Abraão')
    })
  })

  describe('bumpCharacterVersion', () => {
    it('incrementa version e preserva createdAt', () => {
      const v1 = validateCharacter(baseChar())
      const v2 = bumpCharacterVersion(v1, { name: 'Abraão (v2)' })
      expect(v2.version).toBe(2)
      expect(v2.name).toBe('Abraão (v2)')
      expect(v2.createdAt).toBe(v1.createdAt)
    })

    it('preserva isOfficial, workspaceId, forkedFromId', () => {
      const v1 = validateCharacter(
        baseChar({
          forkedFromId: 'original-slug',
          workspaceId: 'ws-1',
          isOfficial: false,
        }),
      )
      const v2 = bumpCharacterVersion(v1, { imageUrls: ['new.png'] })
      expect(v2.forkedFromId).toBe('original-slug')
      expect(v2.workspaceId).toBe('ws-1')
      expect(v2.isOfficial).toBe(false)
    })

    it('valida o resultado (imageUrls não pode virar string)', () => {
      const v1 = validateCharacter(baseChar())
      expect(() =>
        bumpCharacterVersion(v1, {
          imageUrls: 'oops' as unknown as string[],
        }),
      ).toThrow(InvalidCharacterError)
    })
  })

  describe('forkCharacter', () => {
    it('cria cópia com version=1, forkedFromId e isOfficial=false', () => {
      const src = validateCharacter(baseChar({ slug: 'abraao', isOfficial: true }))
      const fork = forkCharacter(src, {
        slug: 'abraao-custom',
        workspaceId: 'ws-1',
        createdBy: 'alice',
      })
      expect(fork.slug).toBe('abraao-custom')
      expect(fork.workspaceId).toBe('ws-1')
      expect(fork.forkedFromId).toBe('abraao')
      expect(fork.version).toBe(1)
      expect(fork.isOfficial).toBe(false)
      expect(fork.createdBy).toBe('alice')
    })

    it('copia imageUrls e tags sem compartilhar referências', () => {
      const src = validateCharacter(
        baseChar({ imageUrls: ['a.png'], tags: ['child', 'boy'] }),
      )
      const fork = forkCharacter(src, {
        slug: 'abraao-2',
        workspaceId: null,
      })
      fork.imageUrls.push('b.png')
      expect(src.imageUrls).toHaveLength(1)
    })

    it('pode sobrescrever o nome do fork', () => {
      const src = validateCharacter(baseChar())
      const fork = forkCharacter(src, {
        slug: 'abraao-v2',
        workspaceId: 'ws-1',
        name: 'Abraão do Clube',
      })
      expect(fork.name).toBe('Abraão do Clube')
    })
  })
})
