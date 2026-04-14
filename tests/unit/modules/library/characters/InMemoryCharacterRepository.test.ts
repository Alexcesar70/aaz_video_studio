import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryCharacterRepository,
  validateCharacter,
  type Character,
} from '@/modules/library'

function make(overrides: Partial<Character> = {}): Character {
  return validateCharacter({
    slug: 'abraao',
    name: 'Abraão',
    imageUrls: ['a.png'],
    workspaceId: null,
    isOfficial: true,
    version: 1,
    ...overrides,
  })
}

describe('InMemoryCharacterRepository', () => {
  let repo: InMemoryCharacterRepository
  beforeEach(() => {
    repo = new InMemoryCharacterRepository()
  })

  it('upsert + findBySlugExact', async () => {
    const c = make()
    await repo.upsert(c)
    expect(await repo.findBySlugExact('abraao', null)).toEqual(c)
  })

  it('findBySlug faz fallback workspace → global', async () => {
    await repo.upsert(make({ workspaceId: null, name: 'Abraão global' }))
    // Workspace não tem override → fallback
    const got = await repo.findBySlug('abraao', 'ws-1')
    expect(got?.name).toBe('Abraão global')
  })

  it('findBySlug respeita override do workspace', async () => {
    await repo.upsert(make({ workspaceId: null, name: 'Abraão global' }))
    await repo.upsert(
      make({
        slug: 'abraao',
        workspaceId: 'ws-1',
        isOfficial: false,
        name: 'Abraão customizado',
      }),
    )
    const got = await repo.findBySlug('abraao', 'ws-1')
    expect(got?.name).toBe('Abraão customizado')
  })

  it('findBySlugExact não faz fallback', async () => {
    await repo.upsert(make({ workspaceId: null }))
    expect(await repo.findBySlugExact('abraao', 'ws-1')).toBeNull()
  })

  it('list filtra por workspaceId', async () => {
    await repo.upsert(make({ workspaceId: null }))
    await repo.upsert(make({ workspaceId: 'ws-1', isOfficial: false }))
    const global = await repo.list({ workspaceId: null })
    expect(global).toHaveLength(1)
    expect(global[0].workspaceId).toBeNull()
  })

  it('list ordena oficiais primeiro', async () => {
    await repo.upsert(
      make({
        slug: 'custom',
        workspaceId: null,
        isOfficial: false,
      }),
    )
    await repo.upsert(
      make({
        slug: 'official',
        workspaceId: null,
        isOfficial: true,
      }),
    )
    const all = await repo.list()
    expect(all[0].slug).toBe('official')
    expect(all[1].slug).toBe('custom')
  })

  it('upsert com version diferente arquiva a anterior', async () => {
    await repo.upsert(make({ version: 1 }))
    await repo.upsert(make({ version: 2, name: 'Abraão v2' }))
    const versions = await repo.listVersions('abraao', null)
    expect(versions).toHaveLength(1)
    expect(versions[0].version).toBe(1)
    expect(versions[0].name).toBe('Abraão')
  })

  it('upsert sem mudança de version NÃO arquiva', async () => {
    await repo.upsert(make({ version: 1 }))
    await repo.upsert(make({ version: 1, name: 'rename sem bump' }))
    expect(await repo.listVersions('abraao', null)).toEqual([])
  })

  it('remove apaga do store mas preserva histórico', async () => {
    await repo.upsert(make({ version: 1 }))
    await repo.upsert(make({ version: 2, name: 'v2' }))
    await repo.remove('abraao', null)
    expect(await repo.findBySlugExact('abraao', null)).toBeNull()
    const versions = await repo.listVersions('abraao', null)
    expect(versions).toHaveLength(1)
  })
})
