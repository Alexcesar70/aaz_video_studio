import { describe, it, expect, vi } from 'vitest'
import {
  pollJobUntilDone,
  JobFailedError,
  JobTimeoutError,
  type JobPollingView,
} from '@/lib/jobPolling'

function jobResponse(job: JobPollingView): Response {
  return new Response(JSON.stringify({ job }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorResponse(status: number, message = 'boom'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function baseJob(overrides: Partial<JobPollingView> = {}): JobPollingView {
  return {
    id: 'job-1',
    kind: 'video_generation',
    status: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('pollJobUntilDone', () => {
  it('resolve quando job vira completed com output', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jobResponse(baseJob({ status: 'queued' })))
      .mockResolvedValueOnce(jobResponse(baseJob({ status: 'running' })))
      .mockResolvedValueOnce(
        jobResponse(
          baseJob({ status: 'completed', output: { videoUrl: 'u' } }),
        ),
      )

    const result = await pollJobUntilDone<{ videoUrl: string }>('job-1', {
      intervalMs: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    expect(result.status).toBe('completed')
    expect(result.output).toEqual({ videoUrl: 'u' })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('lança JobFailedError quando status=failed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jobResponse(
        baseJob({ status: 'failed', error: { message: 'Segmind 503' } }),
      ),
    )
    await expect(
      pollJobUntilDone('job-1', {
        intervalMs: 1,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(JobFailedError)
  })

  it('lança JobFailedError quando status=canceled', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jobResponse(baseJob({ status: 'canceled' })))
    await expect(
      pollJobUntilDone('job-1', {
        intervalMs: 1,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/cancelado/)
  })

  it('propaga erro HTTP como Error', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(errorResponse(500, 'Redis offline'))
    await expect(
      pollJobUntilDone('job-1', {
        intervalMs: 1,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/Redis offline/)
  })

  it('chama onUpdate a cada consulta', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jobResponse(baseJob({ status: 'queued' })))
      .mockResolvedValueOnce(
        jobResponse(
          baseJob({ status: 'completed', output: null as unknown as undefined }),
        ),
      )
    const updates: string[] = []
    await pollJobUntilDone('job-1', {
      intervalMs: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      onUpdate: (j) => updates.push(j.status),
    })
    expect(updates).toEqual(['queued', 'completed'])
  })

  it('lança JobTimeoutError quando excede timeoutMs', async () => {
    // Factory gera Response novo a cada call (bodies só podem ser lidos 1x)
    const fetchImpl = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(jobResponse(baseJob({ status: 'running' }))),
      )
    await expect(
      pollJobUntilDone('job-1', {
        intervalMs: 5,
        timeoutMs: 30,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(JobTimeoutError)
  })

  it('constrói URL com encodeURIComponent no jobId', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jobResponse(
          baseJob({ status: 'completed', output: null as unknown as undefined }),
        ),
      )
    await pollJobUntilDone('weird/id with spaces', {
      intervalMs: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/jobs/weird%2Fid%20with%20spaces',
      expect.objectContaining({ method: 'GET' }),
    )
  })
})
