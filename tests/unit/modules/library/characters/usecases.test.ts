import { describe, it, expect, beforeEach } from 'vitest'
import {
  upsertCharacter,
  getCharacter,
  getCharacterOrThrow,
  listCharacters,
  listCharactersVisibleTo,
  getCharacterVersions,
  CharacterConflictError,
  CharacterNotFoundError,
  InMemoryCharacterRepository,
} from '@/modules/library'

describe('characters — use cases', () => {
  let repo: InMemoryCharacterRepository
  beforeEach(() => {
    repo = new InMemoryCharacterRepository()
  })

  describe('upsertCharacter', () => {
    it('cria novo (action=created, version=1)', async () => {
      const res = await upsertCharacter(
        { repo },
        {
          slug: 'moises',
          workspaceId: null,
          name: 'Moisés',
          imageUrls: ['m.png'],
          isOfficial: true,
        },
      )
      expect(res.action).toBe('created')
      expect(res.character.version).toBe(1)
      expect(res.character.isOfficial).toBe(true)
    })

    it('idempotência: 2a chamada com mesmo conteúdo é unchanged', async () => {
      const input = {
        slug: 'jesus',
        workspaceId: null,
        name: 'Jesus',
        imageUrls: ['j.png'],
      }
      await upsertCharacter({ repo }, input)
      const r2 = await upsertCharacter({ repo }, input)
      expect(r2.action).toBe('unchanged')
      expect(r2.character.version).toBe(1)
    })

    it('edição bumpa version e arquiva anterior (action=updated)', async () => {
      await upsertCharacter(
        { repo },
        {
          slug: 'abraao',
          workspaceId: null,
          name: 'Abraão',
          imageUrls: ['a.png'],
        },
      )
      const r2 = await upsertCharacter(
        { repo },
        {
          slug: 'abraao',
          workspaceId: null,
          name: 'Abraão (v2)',
          imageUrls: ['a.png', 'a2.png'],
        },
      )
      expect(r2.action).toBe('updated')
      expect(r2.character.version).toBe(2)
      expect(r2.character.name).toBe('Abraão (v2)')

      const versions = await repo.listVersions('abraao', null)
      expect(versions).toHaveLength(1)
      expect(versions[0].version).toBe(1)
    })

    it('registra actorUserId em createdBy/updatedBy', async () => {
      const r1 = await upsertCharacter(
        { repo },
        {
          slug: 'x',
          workspaceId: 'ws-1',
          name: 'X',
          imageUrls: [],
          actorUserId: 'alice',
        },
      )
      expect(r1.character.createdBy).toBe('alice')
      expect(r1.character.updatedBy).toBe('alice')

      const r2 = await upsertCharacter(
        { repo },
        {
          slug: 'x',
          workspaceId: 'ws-1',
          name: 'X v2',
          imageUrls: [],
          actorUserId: 'bob',
        },
      )
      // createdBy permanece, updatedBy muda
      expect(r2.character.createdBy).toBe('alice')
      expect(r2.character.updatedBy).toBe('bob')
    })

    it('bloqueia override de um global isOfficial', async () => {
      await upsertCharacter(
        { repo },
        {
          slug: 'jesus',
          workspaceId: null,
          name: 'Jesus',
          imageUrls: [],
          isOfficial: true,
        },
      )
      await expect(
        upsertCharacter(
          { repo },
          {
            slug: 'jesus',
            workspaceId: 'ws-1',
            name: 'Jesus custom',
            imageUrls: [],
          },
        ),
      ).rejects.toThrow(CharacterConflictError)
    })

    it('permite override de um global NÃO-oficial', async () => {
      await upsertCharacter(
        { repo },
        {
          slug: 'comum',
          workspaceId: null,
          name: 'Comum',
          imageUrls: [],
          isOfficial: false,
        },
      )
      const r = await upsertCharacter(
        { repo },
        {
          slug: 'comum',
          workspaceId: 'ws-1',
          name: 'Comum Custom',
          imageUrls: [],
        },
      )
      expect(r.action).toBe('created')
    })
  })

  describe('getCharacter / getCharacterOrThrow', () => {
    it('retorna null quando não existe', async () => {
      expect(await getCharacter({ repo }, { slug: 'missing' })).toBeNull()
    })

    it('getCharacterOrThrow lança CharacterNotFoundError', async () => {
      await expect(
        getCharacterOrThrow({ repo }, { slug: 'x' }),
      ).rejects.toThrow(CharacterNotFoundError)
    })
  })

  describe('listCharacters', () => {
    it('passa filtros ao repo', async () => {
      await upsertCharacter(
        { repo },
        { slug: 'a', workspaceId: null, name: 'A', imageUrls: [], isOfficial: true },
      )
      await upsertCharacter(
        { repo },
        { slug: 'b', workspaceId: 'ws-1', name: 'B', imageUrls: [] },
      )
      expect(await listCharacters({ repo }, { workspaceId: null })).toHaveLength(1)
      expect(await listCharacters({ repo }, { workspaceId: 'ws-1' })).toHaveLength(1)
    })
  })

  describe('listCharactersVisibleTo', () => {
    it('mescla globais + workspace, com override vencendo', async () => {
      await upsertCharacter(
        { repo },
        {
          slug: 'abraao',
          workspaceId: null,
          name: 'Abraão Global',
          imageUrls: [],
          isOfficial: true,
        },
      )
      await upsertCharacter(
        { repo },
        {
          slug: 'moises',
          workspaceId: null,
          name: 'Moisés',
          imageUrls: [],
          isOfficial: true,
        },
      )
      // ws-1 tem custom 'comum' — e um override do global 'abraao'? Aqui não,
      // porque abraao é official. Usa slug distinto.
      await upsertCharacter(
        { repo },
        {
          slug: 'comum',
          workspaceId: 'ws-1',
          name: 'Comum WS',
          imageUrls: [],
        },
      )
      const list = await listCharactersVisibleTo(
        { repo },
        { workspaceId: 'ws-1' },
      )
      const slugs = list.map((c) => c.slug)
      expect(slugs).toContain('abraao')
      expect(slugs).toContain('moises')
      expect(slugs).toContain('comum')
    })

    it('override do workspace vence sobre global de mesmo slug (não-oficial)', async () => {
      await upsertCharacter(
        { repo },
        {
          slug: 'figurante',
          workspaceId: null,
          name: 'Global Figurante',
          imageUrls: [],
          isOfficial: false,
        },
      )
      await upsertCharacter(
        { repo },
        {
          slug: 'figurante',
          workspaceId: 'ws-1',
          name: 'Custom Figurante',
          imageUrls: [],
        },
      )
      const list = await listCharactersVisibleTo(
        { repo },
        { workspaceId: 'ws-1' },
      )
      const figurantes = list.filter((c) => c.slug === 'figurante')
      expect(figurantes).toHaveLength(1)
      expect(figurantes[0].name).toBe('Custom Figurante')
    })

    it('workspaceId=null retorna apenas globais', async () => {
      await upsertCharacter(
        { repo },
        {
          slug: 'g',
          workspaceId: null,
          name: 'G',
          imageUrls: [],
          isOfficial: true,
        },
      )
      await upsertCharacter(
        { repo },
        { slug: 'ws', workspaceId: 'ws-1', name: 'WS', imageUrls: [] },
      )
      const list = await listCharactersVisibleTo(
        { repo },
        { workspaceId: null },
      )
      expect(list).toHaveLength(1)
      expect(list[0].slug).toBe('g')
    })
  })

  describe('getCharacterVersions', () => {
    it('retorna [] quando character nem existe', async () => {
      expect(
        await getCharacterVersions({ repo }, { slug: 'x' }),
      ).toEqual([])
    })

    it('retorna [corrente, ...histórico] em ordem', async () => {
      await upsertCharacter(
        { repo },
        {
          slug: 'abraao',
          workspaceId: null,
          name: 'v1',
          imageUrls: ['1.png'],
        },
      )
      await upsertCharacter(
        { repo },
        {
          slug: 'abraao',
          workspaceId: null,
          name: 'v2',
          imageUrls: ['1.png', '2.png'],
        },
      )
      await upsertCharacter(
        { repo },
        {
          slug: 'abraao',
          workspaceId: null,
          name: 'v3',
          imageUrls: ['1.png', '2.png', '3.png'],
        },
      )
      const versions = await getCharacterVersions(
        { repo },
        { slug: 'abraao' },
      )
      expect(versions.map((v) => v.version)).toEqual([3, 2, 1])
    })
  })
})
