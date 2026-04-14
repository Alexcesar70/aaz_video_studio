import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryPromptTemplateRepository,
  validatePromptTemplate,
  type PromptTemplate,
} from '@/modules/prompts'

function makeTemplate(overrides: Partial<PromptTemplate> = {}): PromptTemplate {
  return validatePromptTemplate({
    slug: 'scene_director_base',
    kind: 'scene_director',
    content: 'Base content',
    version: 1,
    workspaceId: null,
    ...overrides,
  })
}

describe('InMemoryPromptTemplateRepository', () => {
  let repo: InMemoryPromptTemplateRepository

  beforeEach(() => {
    repo = new InMemoryPromptTemplateRepository()
  })

  describe('upsert + findBySlugExact', () => {
    it('persiste e recupera um template global', async () => {
      const saved = await repo.upsert(makeTemplate())
      const found = await repo.findBySlugExact('scene_director_base', null)
      expect(found).toEqual(saved)
    })

    it('template global e override do workspace são independentes', async () => {
      await repo.upsert(makeTemplate({ content: 'global' }))
      await repo.upsert(
        makeTemplate({ workspaceId: 'ws-1', content: 'ws-override' }),
      )

      const global = await repo.findBySlugExact('scene_director_base', null)
      const ws = await repo.findBySlugExact('scene_director_base', 'ws-1')

      expect(global?.content).toBe('global')
      expect(ws?.content).toBe('ws-override')
    })
  })

  describe('findBySlug (resolução com fallback)', () => {
    it('retorna override do workspace quando existe', async () => {
      await repo.upsert(makeTemplate({ content: 'global' }))
      await repo.upsert(
        makeTemplate({ workspaceId: 'ws-1', content: 'ws-override' }),
      )

      const resolved = await repo.findBySlug('scene_director_base', 'ws-1')
      expect(resolved?.content).toBe('ws-override')
    })

    it('faz fallback para global quando workspace não tem override', async () => {
      await repo.upsert(makeTemplate({ content: 'global' }))

      const resolved = await repo.findBySlug('scene_director_base', 'ws-1')
      expect(resolved?.content).toBe('global')
    })

    it('retorna null quando nem global nem workspace existem', async () => {
      const resolved = await repo.findBySlug('nao_existe', 'ws-1')
      expect(resolved).toBeNull()
    })

    it('sem workspaceId, busca só o global', async () => {
      await repo.upsert(makeTemplate({ content: 'global' }))
      await repo.upsert(
        makeTemplate({ workspaceId: 'ws-1', content: 'ws-override' }),
      )

      const resolved = await repo.findBySlug('scene_director_base')
      expect(resolved?.content).toBe('global')
    })
  })

  describe('list', () => {
    beforeEach(async () => {
      await repo.upsert(makeTemplate({ slug: 'scene_director_base', kind: 'scene_director' }))
      await repo.upsert(
        makeTemplate({ slug: 'lyrics_director', kind: 'lyrics_director' }),
      )
      await repo.upsert(
        makeTemplate({
          slug: 'scene_director_base',
          kind: 'scene_director',
          workspaceId: 'ws-1',
          content: 'ws-content',
        }),
      )
    })

    it('sem filtro, retorna todos', async () => {
      const all = await repo.list()
      expect(all).toHaveLength(3)
    })

    it('filtra por kind', async () => {
      const scene = await repo.list({ kind: 'scene_director' })
      expect(scene).toHaveLength(2)
      const lyrics = await repo.list({ kind: 'lyrics_director' })
      expect(lyrics).toHaveLength(1)
    })

    it('filtra por workspaceId=null (apenas globais)', async () => {
      const globals = await repo.list({ workspaceId: null })
      expect(globals).toHaveLength(2)
      expect(globals.every((t) => t.workspaceId === null)).toBe(true)
    })

    it('filtra por workspaceId específico (apenas overrides desse ws)', async () => {
      const ws = await repo.list({ workspaceId: 'ws-1' })
      expect(ws).toHaveLength(1)
      expect(ws[0].workspaceId).toBe('ws-1')
    })
  })

  describe('remove', () => {
    it('remove template do escopo exato', async () => {
      await repo.upsert(makeTemplate())
      await repo.remove('scene_director_base', null)
      const found = await repo.findBySlugExact('scene_director_base', null)
      expect(found).toBeNull()
    })

    it('remove não afeta override do workspace', async () => {
      await repo.upsert(makeTemplate({ content: 'global' }))
      await repo.upsert(
        makeTemplate({ workspaceId: 'ws-1', content: 'ws-override' }),
      )

      await repo.remove('scene_director_base', null)

      expect(await repo.findBySlugExact('scene_director_base', null)).toBeNull()
      expect(
        await repo.findBySlugExact('scene_director_base', 'ws-1'),
      ).not.toBeNull()
    })

    it('remove inexistente é no-op', async () => {
      await expect(repo.remove('nao_existe', null)).resolves.toBeUndefined()
    })
  })
})
