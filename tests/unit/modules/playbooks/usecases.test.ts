import { describe, it, expect, beforeEach } from 'vitest'
import {
  upsertPlaybook,
  getPlaybook,
  getPlaybookOrThrow,
  listPlaybooks,
  getPlaybookVersions,
  clonePlaybook,
  PlaybookNotFoundError,
  InMemoryPlaybookRepository,
} from '@/modules/playbooks'

describe('playbook use cases', () => {
  let repo: InMemoryPlaybookRepository
  beforeEach(() => {
    repo = new InMemoryPlaybookRepository()
  })

  describe('upsertPlaybook', () => {
    it('cria novo (action=created, version=1)', async () => {
      const r = await upsertPlaybook(
        { repo },
        {
          slug: 'aaz-classico',
          workspaceId: 'aaz',
          name: 'AAZ Clássico',
        },
      )
      expect(r.action).toBe('created')
      expect(r.playbook.version).toBe(1)
      expect(r.playbook.isOfficial).toBe(false)
    })

    it('idempotência: 2a chamada com mesmo conteúdo é unchanged', async () => {
      const input = {
        slug: 'p',
        workspaceId: 'ws',
        name: 'P',
      }
      await upsertPlaybook({ repo }, input)
      const r2 = await upsertPlaybook({ repo }, input)
      expect(r2.action).toBe('unchanged')
      expect(r2.playbook.version).toBe(1)
    })

    it('edição bumpa version e arquiva anterior', async () => {
      await upsertPlaybook(
        { repo },
        {
          slug: 'p',
          workspaceId: 'ws',
          name: 'P',
          characterSlugs: ['abraao'],
        },
      )
      const r2 = await upsertPlaybook(
        { repo },
        {
          slug: 'p',
          workspaceId: 'ws',
          name: 'P v2',
          characterSlugs: ['abraao', 'jesus'],
        },
      )
      expect(r2.action).toBe('updated')
      expect(r2.playbook.version).toBe(2)

      const versions = await repo.listVersions('p', 'ws')
      expect(versions).toHaveLength(1)
      expect(versions[0].version).toBe(1)
    })

    it('idempotência considera promptOverrides + defaults', async () => {
      const input = {
        slug: 'p',
        workspaceId: 'ws',
        name: 'P',
        promptOverrides: { scene_director_base: 'custom' },
        defaults: { mood: 'warm', durationSec: 8 },
      }
      await upsertPlaybook({ repo }, input)
      const r2 = await upsertPlaybook({ repo }, input)
      expect(r2.action).toBe('unchanged')
    })
  })

  describe('getPlaybook / OrThrow', () => {
    it('null quando ausente', async () => {
      expect(
        await getPlaybook({ repo }, { slug: 'x', workspaceId: 'ws' }),
      ).toBeNull()
    })

    it('OrThrow lança PlaybookNotFoundError', async () => {
      await expect(
        getPlaybookOrThrow({ repo }, { slug: 'x', workspaceId: 'ws' }),
      ).rejects.toThrow(PlaybookNotFoundError)
    })
  })

  describe('listPlaybooks', () => {
    beforeEach(async () => {
      await upsertPlaybook(
        { repo },
        {
          slug: 'oficial',
          workspaceId: 'ws-1',
          name: 'Oficial',
          isOfficial: true,
        },
      )
      await upsertPlaybook(
        { repo },
        {
          slug: 'pessoal',
          workspaceId: 'ws-1',
          name: 'Pessoal',
          actorUserId: 'alice',
        },
      )
      await upsertPlaybook(
        { repo },
        { slug: 'outro-ws', workspaceId: 'ws-2', name: 'Outro' },
      )
    })

    it('filtra por workspace', async () => {
      const ws1 = await listPlaybooks({ repo }, { workspaceId: 'ws-1' })
      expect(ws1).toHaveLength(2)
    })

    it('filtra por isOfficial', async () => {
      const officials = await listPlaybooks(
        { repo },
        { workspaceId: 'ws-1', isOfficial: true },
      )
      expect(officials).toHaveLength(1)
      expect(officials[0].slug).toBe('oficial')
    })

    it('filtra por createdBy', async () => {
      const alices = await listPlaybooks(
        { repo },
        { workspaceId: 'ws-1', createdBy: 'alice' },
      )
      expect(alices).toHaveLength(1)
      expect(alices[0].slug).toBe('pessoal')
    })

    it('ordena oficiais primeiro', async () => {
      const list = await listPlaybooks({ repo }, { workspaceId: 'ws-1' })
      expect(list[0].isOfficial).toBe(true)
    })
  })

  describe('getPlaybookVersions', () => {
    it('retorna [] quando não existe', async () => {
      expect(
        await getPlaybookVersions({ repo }, { slug: 'x', workspaceId: 'ws' }),
      ).toEqual([])
    })

    it('retorna [corrente, ...histórico] desc', async () => {
      const ws = 'ws'
      await upsertPlaybook(
        { repo },
        { slug: 'p', workspaceId: ws, name: 'v1' },
      )
      await upsertPlaybook(
        { repo },
        {
          slug: 'p',
          workspaceId: ws,
          name: 'v2',
          characterSlugs: ['a'],
        },
      )
      await upsertPlaybook(
        { repo },
        {
          slug: 'p',
          workspaceId: ws,
          name: 'v3',
          characterSlugs: ['a', 'b'],
        },
      )
      const versions = await getPlaybookVersions(
        { repo },
        { slug: 'p', workspaceId: ws },
      )
      expect(versions.map((v) => v.version)).toEqual([3, 2, 1])
    })
  })

  describe('clonePlaybook', () => {
    it('clona pra mesmo workspace com novo slug', async () => {
      await upsertPlaybook(
        { repo },
        {
          slug: 'src',
          workspaceId: 'ws-1',
          name: 'Source',
          isOfficial: true,
          characterSlugs: ['abraao'],
        },
      )
      const fork = await clonePlaybook(
        { repo },
        {
          sourceSlug: 'src',
          sourceWorkspaceId: 'ws-1',
          targetSlug: 'meu-fork',
          targetWorkspaceId: 'ws-1',
          actorUserId: 'alice',
        },
      )
      expect(fork.slug).toBe('meu-fork')
      expect(fork.isOfficial).toBe(false)
      expect(fork.forkedFromId).toBe('src')
      expect(fork.version).toBe(1)
      expect(fork.characterSlugs).toEqual(['abraao'])
      expect(fork.createdBy).toBe('alice')
    })

    it('clona pra outro workspace', async () => {
      await upsertPlaybook(
        { repo },
        { slug: 'src', workspaceId: 'ws-1', name: 'X' },
      )
      const fork = await clonePlaybook(
        { repo },
        {
          sourceSlug: 'src',
          sourceWorkspaceId: 'ws-1',
          targetSlug: 'src',
          targetWorkspaceId: 'ws-2',
        },
      )
      expect(fork.workspaceId).toBe('ws-2')
    })

    it('lança PlaybookNotFoundError se source não existe', async () => {
      await expect(
        clonePlaybook(
          { repo },
          {
            sourceSlug: 'missing',
            sourceWorkspaceId: 'ws-1',
            targetSlug: 'x',
            targetWorkspaceId: 'ws-2',
          },
        ),
      ).rejects.toThrow(PlaybookNotFoundError)
    })
  })
})
