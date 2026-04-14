import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryStyleProfileRepository,
  validateStyleProfile,
  type StyleProfile,
} from '@/modules/library'

function makeProfile(overrides: Partial<StyleProfile> = {}): StyleProfile {
  return validateStyleProfile({
    slug: 'clay-massinha',
    name: 'Clay',
    promptBlock: 'clay block',
    version: 1,
    workspaceId: null,
    isOfficial: true,
    ...overrides,
  })
}

describe('InMemoryStyleProfileRepository', () => {
  let repo: InMemoryStyleProfileRepository

  beforeEach(() => {
    repo = new InMemoryStyleProfileRepository()
  })

  describe('findBySlug (precedência workspace → global)', () => {
    it('sem override: retorna global', async () => {
      await repo.upsert(makeProfile({ promptBlock: 'global' }))
      const p = await repo.findBySlug('clay-massinha', 'ws-1')
      expect(p?.promptBlock).toBe('global')
    })

    it('com override: retorna o do workspace', async () => {
      await repo.upsert(makeProfile({ promptBlock: 'global' }))
      await repo.upsert(
        makeProfile({
          workspaceId: 'ws-1',
          promptBlock: 'override-ws1',
          isOfficial: false,
        }),
      )
      const p = await repo.findBySlug('clay-massinha', 'ws-1')
      expect(p?.promptBlock).toBe('override-ws1')
    })

    it('sem workspaceId no call: só busca global', async () => {
      await repo.upsert(
        makeProfile({
          workspaceId: 'ws-1',
          promptBlock: 'ws',
          isOfficial: false,
        }),
      )
      const p = await repo.findBySlug('clay-massinha')
      expect(p).toBeNull()
    })
  })

  describe('listVisibleTo', () => {
    beforeEach(async () => {
      await repo.upsert(makeProfile({ slug: 'clay-massinha', promptBlock: 'global-clay' }))
      await repo.upsert(
        makeProfile({
          slug: 'anime',
          name: 'Anime',
          promptBlock: 'global-anime',
        }),
      )
      await repo.upsert(
        makeProfile({
          slug: 'brand-x',
          name: 'Brand X',
          promptBlock: 'ws1-brand',
          workspaceId: 'ws-1',
          isOfficial: false,
        }),
      )
      await repo.upsert(
        makeProfile({
          slug: 'brand-y',
          name: 'Brand Y',
          promptBlock: 'ws2-brand',
          workspaceId: 'ws-2',
          isOfficial: false,
        }),
      )
    })

    it('workspace 1 vê globais + seus próprios (3 total)', async () => {
      const visible = await repo.listVisibleTo('ws-1')
      const slugs = visible.map((p) => p.slug).sort()
      expect(slugs).toEqual(['anime', 'brand-x', 'clay-massinha'])
    })

    it('workspace 2 vê globais + seus próprios (3 total)', async () => {
      const visible = await repo.listVisibleTo('ws-2')
      const slugs = visible.map((p) => p.slug).sort()
      expect(slugs).toEqual(['anime', 'brand-y', 'clay-massinha'])
    })

    it('sem workspace (null): só globais', async () => {
      const visible = await repo.listVisibleTo(null)
      const slugs = visible.map((p) => p.slug).sort()
      expect(slugs).toEqual(['anime', 'clay-massinha'])
    })
  })

  describe('list com filtros', () => {
    beforeEach(async () => {
      await repo.upsert(
        makeProfile({ slug: 'clay-massinha', tags: ['3d', 'clay'] }),
      )
      await repo.upsert(
        makeProfile({
          slug: 'brand-x',
          name: 'Brand X',
          workspaceId: 'ws-1',
          isOfficial: false,
          tags: ['custom'],
        }),
      )
    })

    it('filtra por isOfficial=true', async () => {
      const officials = await repo.list({ isOfficial: true })
      expect(officials).toHaveLength(1)
      expect(officials[0].slug).toBe('clay-massinha')
    })

    it('filtra por isOfficial=false', async () => {
      const customs = await repo.list({ isOfficial: false })
      expect(customs).toHaveLength(1)
      expect(customs[0].slug).toBe('brand-x')
    })

    it('filtra por tag', async () => {
      const clays = await repo.list({ tag: 'clay' })
      expect(clays).toHaveLength(1)
      expect(clays[0].slug).toBe('clay-massinha')
    })
  })

  describe('remove', () => {
    it('remove do escopo exato, não afeta outros', async () => {
      await repo.upsert(makeProfile({ promptBlock: 'g' }))
      await repo.upsert(
        makeProfile({ workspaceId: 'ws-1', promptBlock: 'w', isOfficial: false }),
      )

      await repo.remove('clay-massinha', null)

      expect(await repo.findBySlugExact('clay-massinha', null)).toBeNull()
      expect(await repo.findBySlugExact('clay-massinha', 'ws-1')).not.toBeNull()
    })
  })
})
