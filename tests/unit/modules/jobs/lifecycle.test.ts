import { describe, it, expect, beforeEach } from 'vitest'
import {
  enqueueJob,
  markRunning,
  markCompleted,
  markFailed,
  updateProgress,
  getJob,
  listJobs,
  JobNotFoundError,
  JobAccessDeniedError,
  InvalidJobTransitionError,
  InMemoryJobRepository,
  RecordingJobRunner,
} from '@/modules/jobs'

describe('Jobs — lifecycle use cases', () => {
  let repo: InMemoryJobRepository
  let runner: RecordingJobRunner

  beforeEach(() => {
    repo = new InMemoryJobRepository()
    runner = new RecordingJobRunner()
  })

  async function enqueueDefault() {
    return enqueueJob(
      { repo, runner },
      {
        kind: 'video_generation',
        input: { prompt: 'x' },
        userId: 'user-1',
        workspaceId: 'ws-1',
      },
    )
  }

  describe('markRunning', () => {
    it('queued → running e incrementa attempts', async () => {
      const j = await enqueueDefault()
      const r = await markRunning({ repo }, { id: j.id })
      expect(r.status).toBe('running')
      expect(r.attempts).toBe(1)
      expect(r.startedAt).toBeTruthy()
    })

    it('lança JobNotFoundError se id não existe', async () => {
      await expect(
        markRunning({ repo }, { id: 'missing' }),
      ).rejects.toThrow(JobNotFoundError)
    })

    it('lança InvalidJobTransitionError em running duplicado', async () => {
      const j = await enqueueDefault()
      await markRunning({ repo }, { id: j.id })
      await expect(
        markRunning({ repo }, { id: j.id }),
      ).rejects.toThrow(InvalidJobTransitionError)
    })
  })

  describe('markCompleted', () => {
    it('running → completed com output', async () => {
      const j = await enqueueDefault()
      await markRunning({ repo }, { id: j.id })
      const c = await markCompleted({ repo }, {
        id: j.id,
        output: { videoUrl: 'https://blob/x.mp4' },
      })
      expect(c.status).toBe('completed')
      expect(c.output).toEqual({ videoUrl: 'https://blob/x.mp4' })
      expect(c.completedAt).toBeTruthy()
    })

    it('rejeita completar job ainda em queued', async () => {
      const j = await enqueueDefault()
      await expect(
        markCompleted({ repo }, { id: j.id, output: {} }),
      ).rejects.toThrow(InvalidJobTransitionError)
    })
  })

  describe('markFailed', () => {
    it('running → failed com error', async () => {
      const j = await enqueueDefault()
      await markRunning({ repo }, { id: j.id })
      const f = await markFailed({ repo }, {
        id: j.id,
        error: { message: 'Segmind 503', code: 'provider' },
      })
      expect(f.status).toBe('failed')
      expect(f.error?.message).toBe('Segmind 503')
      expect(f.completedAt).toBeTruthy()
    })

    it('permite falhar direto de queued (ex.: erro de validação tardia)', async () => {
      const j = await enqueueDefault()
      const f = await markFailed({ repo }, {
        id: j.id,
        error: { message: 'invalid' },
      })
      expect(f.status).toBe('failed')
    })
  })

  describe('updateProgress', () => {
    it('atualiza progress em job running', async () => {
      const j = await enqueueDefault()
      await markRunning({ repo }, { id: j.id })
      const updated = await updateProgress({ repo }, { id: j.id, progress: 42 })
      expect(updated.progress).toBe(42)
      expect(updated.status).toBe('running')
    })

    it('é no-op em job queued (não muda status)', async () => {
      const j = await enqueueDefault()
      const updated = await updateProgress({ repo }, { id: j.id, progress: 50 })
      expect(updated.status).toBe('queued')
      expect(updated.progress).toBeUndefined()
    })

    it('é no-op em job completed', async () => {
      const j = await enqueueDefault()
      await markRunning({ repo }, { id: j.id })
      await markCompleted({ repo }, { id: j.id, output: {} })
      const updated = await updateProgress({ repo }, { id: j.id, progress: 90 })
      expect(updated.status).toBe('completed')
    })
  })

  describe('getJob — autorização', () => {
    it('retorna job quando requesterUserId bate', async () => {
      const j = await enqueueDefault()
      const got = await getJob({ repo }, {
        id: j.id,
        requesterUserId: 'user-1',
      })
      expect(got.id).toBe(j.id)
    })

    it('lança JobAccessDeniedError se user diferente e workspace não bate', async () => {
      const j = await enqueueDefault()
      await expect(
        getJob({ repo }, {
          id: j.id,
          requesterUserId: 'other-user',
          requesterWorkspaceId: 'ws-different',
        }),
      ).rejects.toThrow(JobAccessDeniedError)
    })

    it('permite acesso se user diferente mas workspace bate', async () => {
      const j = await enqueueDefault()
      const got = await getJob({ repo }, {
        id: j.id,
        requesterUserId: 'other-user',
        requesterWorkspaceId: 'ws-1',
      })
      expect(got.id).toBe(j.id)
    })

    it('sem requesterUserId — acesso livre (admin/sistema)', async () => {
      const j = await enqueueDefault()
      const got = await getJob({ repo }, { id: j.id })
      expect(got.id).toBe(j.id)
    })

    it('lança JobNotFoundError para id inexistente', async () => {
      await expect(
        getJob({ repo }, { id: 'missing' }),
      ).rejects.toThrow(JobNotFoundError)
    })
  })

  describe('listJobs', () => {
    it('lista filtrando por userId', async () => {
      await enqueueJob({ repo, runner }, {
        kind: 'video_generation',
        input: {},
        userId: 'alice',
        workspaceId: 'ws-1',
      })
      await enqueueJob({ repo, runner }, {
        kind: 'video_generation',
        input: {},
        userId: 'bob',
        workspaceId: 'ws-1',
      })
      const alices = await listJobs({ repo }, { userId: 'alice' })
      expect(alices).toHaveLength(1)
      expect(alices[0].userId).toBe('alice')
    })
  })
})
