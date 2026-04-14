import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryStyleProfileRepository,
  getStyleProfileVersions,
  upsertStyleProfile,
} from '@/modules/library'

describe('StyleProfile — histórico de versões (M2-PR6)', () => {
  let repo: InMemoryStyleProfileRepository
  beforeEach(() => {
    repo = new InMemoryStyleProfileRepository()
  })

  it('upsert com version diferente arquiva anterior', async () => {
    await upsertStyleProfile(
      { repo },
      {
        slug: 'clay',
        name: 'Clay',
        promptBlock: 'v1 block',
        workspaceId: null,
        isOfficial: true,
      },
    )
    // Segundo upsert com conteúdo diferente bumpa version
    await upsertStyleProfile(
      { repo },
      {
        slug: 'clay',
        name: 'Clay',
        promptBlock: 'v2 block',
        workspaceId: null,
        isOfficial: true,
      },
    )
    const history = await repo.listVersions('clay', null)
    expect(history).toHaveLength(1)
    expect(history[0].promptBlock).toBe('v1 block')
    expect(history[0].version).toBe(1)
  })

  it('upsert idempotente NÃO arquiva nada', async () => {
    const input = {
      slug: 'anime',
      name: 'Anime',
      promptBlock: 'block',
      workspaceId: null as string | null,
      isOfficial: true,
    }
    await upsertStyleProfile({ repo }, input)
    await upsertStyleProfile({ repo }, input)
    expect(await repo.listVersions('anime', null)).toEqual([])
  })

  it('getStyleProfileVersions retorna [corrente, ...histórico] desc', async () => {
    await upsertStyleProfile(
      { repo },
      {
        slug: 'cinema',
        name: 'Cinema',
        promptBlock: 'v1',
        workspaceId: null,
        isOfficial: true,
      },
    )
    await upsertStyleProfile(
      { repo },
      {
        slug: 'cinema',
        name: 'Cinema',
        promptBlock: 'v2',
        workspaceId: null,
        isOfficial: true,
      },
    )
    await upsertStyleProfile(
      { repo },
      {
        slug: 'cinema',
        name: 'Cinema',
        promptBlock: 'v3',
        workspaceId: null,
        isOfficial: true,
      },
    )
    const versions = await getStyleProfileVersions(
      { repo },
      { slug: 'cinema' },
    )
    expect(versions.map((v) => v.version)).toEqual([3, 2, 1])
    expect(versions.map((v) => v.promptBlock)).toEqual(['v3', 'v2', 'v1'])
  })

  it('getStyleProfileVersions retorna [] quando profile não existe', async () => {
    const out = await getStyleProfileVersions({ repo }, { slug: 'missing' })
    expect(out).toEqual([])
  })

  it('remove preserva histórico', async () => {
    await upsertStyleProfile(
      { repo },
      {
        slug: 'gone',
        name: 'Gone',
        promptBlock: 'a',
        workspaceId: null,
        isOfficial: false,
      },
    )
    await upsertStyleProfile(
      { repo },
      {
        slug: 'gone',
        name: 'Gone',
        promptBlock: 'b',
        workspaceId: null,
        isOfficial: false,
      },
    )
    await repo.remove('gone', null)
    expect(await repo.findBySlugExact('gone', null)).toBeNull()
    const history = await repo.listVersions('gone', null)
    expect(history).toHaveLength(1)
  })

  it('histórico é escopo-específico: global e workspace são independentes', async () => {
    await upsertStyleProfile(
      { repo },
      {
        slug: 'dup',
        name: 'Dup',
        promptBlock: 'global v1',
        workspaceId: null,
        isOfficial: false,
      },
    )
    await upsertStyleProfile(
      { repo },
      {
        slug: 'dup',
        name: 'Dup',
        promptBlock: 'global v2',
        workspaceId: null,
        isOfficial: false,
      },
    )
    await upsertStyleProfile(
      { repo },
      {
        slug: 'dup',
        name: 'Dup WS',
        promptBlock: 'ws v1',
        workspaceId: 'ws-1',
        isOfficial: false,
      },
    )
    expect(await repo.listVersions('dup', null)).toHaveLength(1)
    expect(await repo.listVersions('dup', 'ws-1')).toHaveLength(0)
  })
})
