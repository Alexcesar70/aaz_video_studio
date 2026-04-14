/**
 * Client-side helpers for polling async jobs created via /api/generate
 * quando a flag USE_ASYNC_GENERATION está ligada.
 *
 * O handler server-side retorna `{ jobId, status: 'queued', async: true }`
 * em vez do resultado completo. O cliente consulta `GET /api/jobs/:id`
 * até o status virar `completed` ou `failed`.
 *
 * Intencionalmente leve — sem state management, sem hooks React. Fica
 * reusável para qualquer surface (Studio, Atelier, Senoide, etc.).
 */

export type JobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'canceled'

export interface JobPollingView<TOutput = unknown> {
  id: string
  kind: string
  status: JobStatus
  progress?: number
  output?: TOutput
  error?: { message: string; code?: string }
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export class JobFailedError extends Error {
  public readonly code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.name = 'JobFailedError'
    this.code = code
  }
}

export class JobTimeoutError extends Error {
  constructor(jobId: string, timeoutMs: number) {
    super(`Job ${jobId} não terminou em ${Math.round(timeoutMs / 1000)}s`)
    this.name = 'JobTimeoutError'
  }
}

export interface PollJobOptions<TOutput = unknown> {
  /** Intervalo entre consultas (ms). Default: 2000. */
  intervalMs?: number
  /** Timeout total (ms). Default: 600000 = 10min. */
  timeoutMs?: number
  /** Callback disparado a cada transição de status ou mudança de progresso. */
  onUpdate?: (job: JobPollingView<TOutput>) => void
  /** Fetch injetável para testes. */
  fetchImpl?: typeof fetch
}

/**
 * Consulta /api/jobs/:id em intervalos regulares até o job terminar.
 * Retorna o Job final com status='completed' ou lança JobFailedError /
 * JobTimeoutError conforme o caso.
 */
export async function pollJobUntilDone<TOutput = unknown>(
  jobId: string,
  options: PollJobOptions<TOutput> = {},
): Promise<JobPollingView<TOutput>> {
  const interval = options.intervalMs ?? 2000
  const timeout = options.timeoutMs ?? 600_000
  const fetchFn = options.fetchImpl ?? fetch
  const start = Date.now()

  while (true) {
    if (Date.now() - start > timeout) {
      throw new JobTimeoutError(jobId, timeout)
    }

    const res = await fetchFn(`/api/jobs/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      credentials: 'same-origin',
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(
        err?.error ?? `Falha ao consultar job ${jobId}: HTTP ${res.status}`,
      )
    }

    const data = (await res.json()) as { job: JobPollingView<TOutput> }
    const job = data.job
    options.onUpdate?.(job)

    if (job.status === 'completed') return job
    if (job.status === 'failed') {
      throw new JobFailedError(
        job.error?.message ?? 'Job falhou sem descrição',
        job.error?.code,
      )
    }
    if (job.status === 'canceled') {
      throw new JobFailedError('Job foi cancelado', 'canceled')
    }

    await sleep(interval)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
