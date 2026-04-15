import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import {
  InMemoryReferenceAssetRepository,
  validateReferenceAsset,
  type ReferenceAsset,
} from '@/modules/references'

function makeRef(overrides: Partial<ReferenceAsset> = {}): ReferenceAsset {
  return validateReferenceAsset({
    id: randomUUID(),
    mediaType: 'image',
    url: 'https://blob/x.png',
    source: 'upload',
    userId: 'user-1',
    workspaceId: 'ws-1',
    ...overrides,
  })
}

describe('InMemoryReferenceAssetRepository', () => {
  let repo: InMemoryReferenceAssetRepository
  beforeEach(() => {
    repo = new InMemoryReferenceAssetRepository()
  })

  it('upsert + findById', async () => {
    const r = makeRef()
    await repo.upsert(r)
    expect(await repo.findById(r.id)).toEqual(r)
  })

  it('findById null para id inexistente', async () => {
    expect(await repo.findById('missing')).toBeNull()
  })

  it('list filtra por userId', async () => {
    await repo.upsert(makeRef({ userId: 'alice' }))
    await repo.upsert(makeRef({ userId: 'bob' }))
    const mine = await repo.list({ userId: 'alice' })
    expect(mine).toHaveLength(1)
    expect(mine[0].userId).toBe('alice')
  })

  it('list filtra por workspaceId null vs string', async () => {
    await repo.upsert(makeRef({ workspaceId: null }))
    await repo.upsert(makeRef({ workspaceId: 'ws-1' }))
    expect(await repo.list({ workspaceId: null })).toHaveLength(1)
    expect(await repo.list({ workspaceId: 'ws-1' })).toHaveLength(1)
  })

  it('list filtra por mediaType', async () => {
    await repo.upsert(makeRef({ mediaType: 'image' }))
    await repo.upsert(
      makeRef({ mediaType: 'video', url: 'https://blob/x.mp4' }),
    )
    expect(await repo.list({ mediaType: 'image' })).toHaveLength(1)
  })

  it('list filtra por source', async () => {
    await repo.upsert(makeRef({ source: 'upload' }))
    await repo.upsert(makeRef({ source: 'generated' }))
    expect(await repo.list({ source: 'upload' })).toHaveLength(1)
  })

  it('list ordena desc por createdAt', async () => {
    const older = makeRef({ createdAt: '2020-01-01T00:00:00.000Z' })
    const newer = makeRef({ createdAt: '2025-01-01T00:00:00.000Z' })
    await repo.upsert(older)
    await repo.upsert(newer)
    const all = await repo.list()
    expect(all[0].id).toBe(newer.id)
  })

  it('list respeita limit', async () => {
    for (let i = 0; i < 5; i++) await repo.upsert(makeRef())
    expect((await repo.list({ limit: 2 }))).toHaveLength(2)
  })

  it('remove apaga', async () => {
    const r = makeRef()
    await repo.upsert(r)
    await repo.remove(r.id)
    expect(await repo.findById(r.id)).toBeNull()
  })
})
