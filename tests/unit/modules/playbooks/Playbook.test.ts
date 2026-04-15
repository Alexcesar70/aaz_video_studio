import { describe, it, expect } from 'vitest'
import {
  validatePlaybook,
  bumpPlaybookVersion,
  forkPlaybook,
  InvalidPlaybookError,
} from '@/modules/playbooks'

function base(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    slug: 'aaz-classico',
    name: 'AAZ Clássico',
    workspaceId: 'aaz-com-jesus',
    isOfficial: true,
    version: 1,
    ...overrides,
  }
}

describe('Playbook domain', () => {
  describe('validatePlaybook', () => {
    it('aceita minimal válido', () => {
      const p = validatePlaybook(base())
      expect(p.slug).toBe('aaz-classico')
      expect(p.characterSlugs).toEqual([])
      expect(p.workspaceId).toBe('aaz-com-jesus')
    })

    it('trim no name', () => {
      const p = validatePlaybook(base({ name: '  X  ' }))
      expect(p.name).toBe('X')
    })

    it('rejeita slug com caracteres inválidos', () => {
      expect(() => validatePlaybook(base({ slug: 'NOT VALID' }))).toThrow(
        InvalidPlaybookError,
      )
    })

    it('rejeita workspaceId vazio (playbooks são workspace-scoped)', () => {
      expect(() =>
        validatePlaybook(base({ workspaceId: '' })),
      ).toThrow(/workspaceId/)
    })

    it('rejeita name vazio', () => {
      expect(() => validatePlaybook(base({ name: '   ' }))).toThrow(/name/)
    })

    it('rejeita characterSlugs não-array', () => {
      expect(() =>
        validatePlaybook(base({ characterSlugs: 'wrong' as unknown as string })),
      ).toThrow(/characterSlugs/)
    })

    it('rejeita promptOverrides como array', () => {
      expect(() =>
        validatePlaybook(base({ promptOverrides: ['x'] as unknown as Record<string, string> })),
      ).toThrow(/promptOverrides/)
    })

    it('rejeita version não-inteiro', () => {
      expect(() => validatePlaybook(base({ version: 1.5 }))).toThrow(/version/)
    })

    it('rejeita defaults.durationSec <= 0', () => {
      expect(() =>
        validatePlaybook(base({ defaults: { durationSec: 0 } })),
      ).toThrow(/durationSec/)
    })

    it('preserva defaults completo', () => {
      const p = validatePlaybook(
        base({
          defaults: {
            videoEngineId: 'seedance',
            imageEngineId: 'nano-banana',
            mood: 'warm',
            durationSec: 8,
          },
        }),
      )
      expect(p.defaults?.videoEngineId).toBe('seedance')
      expect(p.defaults?.durationSec).toBe(8)
    })
  })

  describe('bumpPlaybookVersion', () => {
    it('incrementa version e mantém createdAt', () => {
      const v1 = validatePlaybook(base())
      const v2 = bumpPlaybookVersion(v1, { name: 'AAZ Clássico v2' })
      expect(v2.version).toBe(2)
      expect(v2.name).toBe('AAZ Clássico v2')
      expect(v2.createdAt).toBe(v1.createdAt)
    })

    it('preserva isOfficial, workspaceId, forkedFromId', () => {
      const v1 = validatePlaybook(
        base({ isOfficial: false, forkedFromId: 'origem' }),
      )
      const v2 = bumpPlaybookVersion(v1, { description: 'nova descrição' })
      expect(v2.isOfficial).toBe(false)
      expect(v2.forkedFromId).toBe('origem')
    })
  })

  describe('forkPlaybook', () => {
    it('cria fork com version=1, isOfficial=false, forkedFromId', () => {
      const src = validatePlaybook(base({ slug: 'src', isOfficial: true }))
      const fork = forkPlaybook(src, {
        slug: 'meu-fork',
        workspaceId: 'aaz-com-jesus',
        createdBy: 'alice',
      })
      expect(fork.slug).toBe('meu-fork')
      expect(fork.forkedFromId).toBe('src')
      expect(fork.version).toBe(1)
      expect(fork.isOfficial).toBe(false)
      expect(fork.createdBy).toBe('alice')
    })

    it('copia arrays/objects sem compartilhar referências', () => {
      const src = validatePlaybook(
        base({
          characterSlugs: ['abraao', 'jesus'],
          promptOverrides: { scene_director_base: 'custom' },
          defaults: { mood: 'warm' },
        }),
      )
      const fork = forkPlaybook(src, {
        slug: 'fork',
        workspaceId: 'ws-2',
      })
      fork.characterSlugs.push('extra')
      ;(fork.promptOverrides as Record<string, string>).extra = 'x'
      expect(src.characterSlugs).toHaveLength(2)
      expect(src.promptOverrides).toEqual({ scene_director_base: 'custom' })
    })

    it('pode mover pra outro workspace via param', () => {
      const src = validatePlaybook(base({ workspaceId: 'ws-1' }))
      const fork = forkPlaybook(src, { slug: 'x', workspaceId: 'ws-2' })
      expect(fork.workspaceId).toBe('ws-2')
    })
  })
})
