import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import {
  InMemoryJobRepository,
  validateJob,
  type Job,
} from '@/modules/jobs'

function makeJob(overrides: Partial<Job> = {}): Job {
  return validateJob({
    id: randomUUID(),
    kind: 'video_generation',
    status: 'queued',
    input: { prompt: 'x' },
    attempts: 0,
    userId: 'user-1',
    workspaceId: 'ws-1',
    ...overrides,
  })
}

describe('InMemoryJobRepository', () => {
  let repo: InMemoryJobRepository

  beforeEach(() => {
    repo = new InMemoryJobRepository()
  })

  it('upsert + findById — round-trip', async () => {
    const j = makeJob()
    await repo.upsert(j)
    const loaded = await repo.findById(j.id)
    expect(loaded).toEqual(j)
  })

  it('findById retorna null para id inexistente', async () => {
    expect(await repo.findById('missing')).toBeNull()
  })

  it('list sem filtro retorna todos os jobs', async () => {
    const a = makeJob()
    const b = makeJob({ userId: 'user-2' })
    await repo.upsert(a)
    await repo.upsert(b)
    const all = await repo.list()
    expect(all).toHaveLength(2)
  })

  it('list filtra por userId', async () => {
    await repo.upsert(makeJob({ userId: 'user-1' }))
    await repo.upsert(makeJob({ userId: 'user-2' }))
    const mine = await repo.list({ userId: 'user-1' })
    expect(mine).toHaveLength(1)
    expect(mine[0].userId).toBe('user-1')
  })

  it('list filtra por workspaceId null vs string', async () => {
    await repo.upsert(makeJob({ workspaceId: null }))
    await repo.upsert(makeJob({ workspaceId: 'ws-1' }))
    const systemJobs = await repo.list({ workspaceId: null })
    const wsJobs = await repo.list({ workspaceId: 'ws-1' })
    expect(systemJobs).toHaveLength(1)
    expect(wsJobs).toHaveLength(1)
  })

  it('list filtra por kind', async () => {
    await repo.upsert(makeJob({ kind: 'video_generation' }))
    await repo.upsert(makeJob({ kind: 'image_generation' }))
    const vids = await repo.list({ kind: 'video_generation' })
    expect(vids).toHaveLength(1)
  })

  it('list filtra por status', async () => {
    await repo.upsert(makeJob({ status: 'queued' }))
    await repo.upsert(
      makeJob({ status: 'completed', output: { url: 'x' } }),
    )
    const queued = await repo.list({ status: 'queued' })
    expect(queued).toHaveLength(1)
  })

  it('list ordena por createdAt desc', async () => {
    const older = makeJob({ createdAt: '2020-01-01T00:00:00.000Z' })
    const newer = makeJob({ createdAt: '2025-01-01T00:00:00.000Z' })
    await repo.upsert(older)
    await repo.upsert(newer)
    const all = await repo.list()
    expect(all[0].id).toBe(newer.id)
    expect(all[1].id).toBe(older.id)
  })

  it('list respeita limit', async () => {
    for (let i = 0; i < 5; i++) await repo.upsert(makeJob())
    const limited = await repo.list({ limit: 2 })
    expect(limited).toHaveLength(2)
  })

  it('remove apaga o job', async () => {
    const j = makeJob()
    await repo.upsert(j)
    expect(repo.size()).toBe(1)
    await repo.remove(j.id)
    expect(await repo.findById(j.id)).toBeNull()
    expect(repo.size()).toBe(0)
  })

  it('upsert é idempotente (mesmo id → substitui)', async () => {
    const j = makeJob()
    await repo.upsert(j)
    await repo.upsert({ ...j, metadata: { note: 'updated' } })
    expect(repo.size()).toBe(1)
    const loaded = await repo.findById(j.id)
    expect(loaded?.metadata?.note).toBe('updated')
  })
})
