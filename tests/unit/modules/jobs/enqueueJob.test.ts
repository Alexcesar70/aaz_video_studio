import { describe, it, expect, beforeEach } from 'vitest'
import {
  enqueueJob,
  InMemoryJobRepository,
  RecordingJobRunner,
} from '@/modules/jobs'

describe('enqueueJob', () => {
  let repo: InMemoryJobRepository
  let runner: RecordingJobRunner

  beforeEach(() => {
    repo = new InMemoryJobRepository()
    runner = new RecordingJobRunner()
  })

  it('cria job em status queued, persiste e publica no runner', async () => {
    const job = await enqueueJob(
      { repo, runner },
      {
        kind: 'video_generation',
        input: { prompt: 'hello', duration: 5 },
        userId: 'user-1',
        workspaceId: 'ws-1',
      },
    )

    expect(job.status).toBe('queued')
    expect(job.attempts).toBe(0)
    expect(job.userId).toBe('user-1')
    expect(job.workspaceId).toBe('ws-1')
    expect(job.kind).toBe('video_generation')

    // Persistido
    const loaded = await repo.findById(job.id)
    expect(loaded).toEqual(job)

    // Publicado
    expect(runner.calls).toHaveLength(1)
    expect(runner.calls[0].jobId).toBe(job.id)
    expect(runner.calls[0].kind).toBe('video_generation')
    expect(runner.calls[0].input).toEqual({ prompt: 'hello', duration: 5 })
    expect(runner.calls[0].userId).toBe('user-1')
    expect(runner.calls[0].workspaceId).toBe('ws-1')
  })

  it('gera uuid v4 quando id não é fornecido', async () => {
    const job = await enqueueJob(
      { repo, runner },
      {
        kind: 'image_generation',
        input: null,
        userId: 'user-1',
        workspaceId: null,
      },
    )
    expect(job.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('respeita id fornecido (retry/idempotência externa)', async () => {
    const id = '12345678-1234-4234-8234-123456789abc'
    const job = await enqueueJob(
      { repo, runner },
      {
        kind: 'video_generation',
        input: {},
        userId: 'u',
        workspaceId: null,
        id,
      },
    )
    expect(job.id).toBe(id)
  })

  it('anexa metadata no job', async () => {
    const job = await enqueueJob(
      { repo, runner },
      {
        kind: 'video_generation',
        input: {},
        userId: 'u',
        workspaceId: 'ws',
        metadata: { engineId: 'seedance', duration: 5 },
      },
    )
    expect(job.metadata).toEqual({ engineId: 'seedance', duration: 5 })
  })
})
