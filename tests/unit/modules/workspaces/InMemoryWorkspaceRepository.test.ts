import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryWorkspaceRepository,
  getWorkspace,
  getWorkspaceOrThrow,
  WorkspaceNotFoundError,
  type Workspace,
} from '@/modules/workspaces'

function make(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: 'ws-1',
    name: 'Test',
    slug: 'test',
    plan: 'free',
    status: 'active',
    ownerId: 'u-1',
    type: 'individual',
    maxUsers: 1,
    walletId: 'wlt-1',
    products: ['aaz_studio'],
    leaderCanCreate: true,
    billingEmail: 'test@x',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('InMemoryWorkspaceRepository', () => {
  let repo: InMemoryWorkspaceRepository
  beforeEach(() => {
    repo = new InMemoryWorkspaceRepository()
  })

  it('upsert + findById', async () => {
    const w = make()
    await repo.upsert(w)
    expect(await repo.findById('ws-1')).toEqual(w)
  })

  it('findBySlug resolve pelo slug secundário', async () => {
    const w = make({ id: 'ws-1', slug: 'aaz-com-jesus' })
    await repo.upsert(w)
    expect((await repo.findBySlug('aaz-com-jesus'))?.id).toBe('ws-1')
  })

  it('rejeita upsert com slug já usado por OUTRO id', async () => {
    await repo.upsert(make({ id: 'a', slug: 'shared' }))
    await expect(
      repo.upsert(make({ id: 'b', slug: 'shared' })),
    ).rejects.toThrow(/já pertence/)
  })

  it('permite atualizar próprio workspace mudando o slug', async () => {
    await repo.upsert(make({ id: 'a', slug: 'old' }))
    await repo.upsert(make({ id: 'a', slug: 'new' }))
    expect((await repo.findBySlug('new'))?.id).toBe('a')
    expect(await repo.findBySlug('old')).toBeNull()
  })

  it('list filtra por status', async () => {
    await repo.upsert(make({ id: 'a', slug: 'a', status: 'active' }))
    await repo.upsert(make({ id: 'b', slug: 'b', status: 'suspended' }))
    const actives = await repo.list({ status: 'active' })
    expect(actives).toHaveLength(1)
    expect(actives[0].id).toBe('a')
  })

  it('list filtra por ownerId', async () => {
    await repo.upsert(make({ id: 'a', slug: 'a', ownerId: 'alice' }))
    await repo.upsert(make({ id: 'b', slug: 'b', ownerId: 'bob' }))
    const aliceWs = await repo.list({ ownerId: 'alice' })
    expect(aliceWs).toHaveLength(1)
  })

  it('remove limpa id + slug index', async () => {
    await repo.upsert(make({ id: 'a', slug: 'to-delete' }))
    await repo.remove('a')
    expect(await repo.findById('a')).toBeNull()
    expect(await repo.findBySlug('to-delete')).toBeNull()
  })
})

describe('workspaces — use cases', () => {
  let repo: InMemoryWorkspaceRepository
  beforeEach(() => {
    repo = new InMemoryWorkspaceRepository()
  })

  it('getWorkspace por id', async () => {
    await repo.upsert(make({ id: 'ws-1' }))
    expect((await getWorkspace({ repo }, { id: 'ws-1' }))?.id).toBe('ws-1')
  })

  it('getWorkspace por slug', async () => {
    await repo.upsert(make({ id: 'ws-1', slug: 'my-slug' }))
    expect(
      (await getWorkspace({ repo }, { slug: 'my-slug' }))?.id,
    ).toBe('ws-1')
  })

  it('getWorkspace sem param retorna null', async () => {
    expect(await getWorkspace({ repo }, {})).toBeNull()
  })

  it('getWorkspaceOrThrow lança quando não existe', async () => {
    await expect(
      getWorkspaceOrThrow({ repo }, { id: 'missing' }),
    ).rejects.toThrow(WorkspaceNotFoundError)
  })
})
