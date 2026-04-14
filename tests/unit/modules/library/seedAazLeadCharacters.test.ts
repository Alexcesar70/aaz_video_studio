import { describe, it, expect, beforeEach } from 'vitest'
import {
  seedAazLeadCharacters,
  AAZ_LEAD_CHARACTERS,
  AAZ_DEFAULT_ORG_ID,
  type SeedRedisLike,
} from '@/modules/library'
import type { Asset } from '@/lib/assets'

/**
 * Fake Redis client usando Map em memória.
 * Implementa só os métodos necessários ao seed (get/set).
 */
class FakeRedis implements SeedRedisLike {
  store = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }

  async set(key: string, value: string): Promise<string> {
    this.store.set(key, value)
    return 'OK'
  }

  getParsed(key: string): Asset | null {
    const raw = this.store.get(key)
    if (!raw) return null
    return JSON.parse(raw) as Asset
  }
}

describe('seedAazLeadCharacters', () => {
  let redis: FakeRedis

  beforeEach(() => {
    redis = new FakeRedis()
  })

  describe('primeira execução (DB vazio)', () => {
    it('cria os 7 leads com action=created', async () => {
      const results = await seedAazLeadCharacters({ redis })

      expect(results).toHaveLength(7)
      expect(results.every((r) => r.action === 'created')).toBe(true)
    })

    it('todos os registros gravados têm organizationId=aaz-com-jesus', async () => {
      await seedAazLeadCharacters({ redis })

      for (const lead of AAZ_LEAD_CHARACTERS) {
        const saved = redis.getParsed(`aaz:asset:character:${lead.id}`)
        expect(saved?.organizationId).toBe(AAZ_DEFAULT_ORG_ID)
      }
    })

    it('todos os registros gravados têm isOfficial=true', async () => {
      await seedAazLeadCharacters({ redis })

      for (const lead of AAZ_LEAD_CHARACTERS) {
        const saved = redis.getParsed(`aaz:asset:character:${lead.id}`)
        expect(saved?.isOfficial).toBe(true)
      }
    })

    it('grava createdBy quando informado', async () => {
      await seedAazLeadCharacters({ redis, createdBy: 'alex' })

      const saved = redis.getParsed(`aaz:asset:character:abraao`)
      expect(saved?.createdBy).toBe('alex')
    })

    it('aceita organizationId customizado', async () => {
      await seedAazLeadCharacters({ redis, organizationId: 'outra-org' })

      const saved = redis.getParsed(`aaz:asset:character:abraao`)
      expect(saved?.organizationId).toBe('outra-org')
    })
  })

  describe('segunda execução com strategy=skip', () => {
    it('todos viram skipped', async () => {
      await seedAazLeadCharacters({ redis })
      const second = await seedAazLeadCharacters({ redis, strategy: 'skip' })

      expect(second.every((r) => r.action === 'skipped')).toBe(true)
    })

    it('não sobrescreve imageUrls existentes', async () => {
      // Simula: admin rodou seed, depois alguém adicionou refs via POST.
      await seedAazLeadCharacters({ redis })
      const key = `aaz:asset:character:abraao`
      const original = redis.getParsed(key)!
      original.imageUrls = ['https://example.com/ref1.png']
      redis.store.set(key, JSON.stringify(original))

      await seedAazLeadCharacters({ redis, strategy: 'skip' })

      const after = redis.getParsed(key)
      expect(after?.imageUrls).toEqual(['https://example.com/ref1.png'])
    })
  })

  describe('segunda execução com strategy=update', () => {
    it('todos viram updated e preservam imageUrls', async () => {
      await seedAazLeadCharacters({ redis })

      // Adiciona imageUrls no registro existente
      const key = `aaz:asset:character:abraao`
      const original = redis.getParsed(key)!
      const userRefs = ['https://example.com/ref1.png', 'https://example.com/ref2.png']
      redis.store.set(key, JSON.stringify({ ...original, imageUrls: userRefs }))

      const second = await seedAazLeadCharacters({ redis, strategy: 'update' })

      expect(second.every((r) => r.action === 'updated')).toBe(true)

      const after = redis.getParsed(key)
      expect(after?.imageUrls).toEqual(userRefs)
    })

    it('descrição é atualizada (traz a versão do seed)', async () => {
      // Simula registro com descrição antiga
      const key = `aaz:asset:character:abraao`
      const outdated: Asset = {
        ...AAZ_LEAD_CHARACTERS[0],
        description: 'descrição velha e errada',
        organizationId: AAZ_DEFAULT_ORG_ID,
      }
      redis.store.set(key, JSON.stringify(outdated))

      await seedAazLeadCharacters({ redis, strategy: 'update' })

      const after = redis.getParsed(key)
      expect(after?.description).toBe(AAZ_LEAD_CHARACTERS[0].description)
      expect(after?.description).not.toBe('descrição velha e errada')
    })

    it('preserva createdAt original', async () => {
      const key = `aaz:asset:character:abraao`
      const existing: Asset = {
        ...AAZ_LEAD_CHARACTERS[0],
        createdAt: '2020-06-15T10:00:00.000Z',
        organizationId: AAZ_DEFAULT_ORG_ID,
      }
      redis.store.set(key, JSON.stringify(existing))

      await seedAazLeadCharacters({ redis, strategy: 'update' })

      const after = redis.getParsed(key)
      expect(after?.createdAt).toBe('2020-06-15T10:00:00.000Z')
    })
  })

  describe('mistura (alguns existem, alguns não)', () => {
    it('retorna actions coerentes por id', async () => {
      // Pré-popula apenas abraao
      const key = `aaz:asset:character:abraao`
      redis.store.set(
        key,
        JSON.stringify({
          ...AAZ_LEAD_CHARACTERS[0],
          organizationId: AAZ_DEFAULT_ORG_ID,
        }),
      )

      const results = await seedAazLeadCharacters({ redis, strategy: 'skip' })

      const abraaoResult = results.find((r) => r.id === 'abraao')
      const othersResults = results.filter((r) => r.id !== 'abraao')

      expect(abraaoResult?.action).toBe('skipped')
      expect(othersResults.every((r) => r.action === 'created')).toBe(true)
    })
  })
})
