import { randomUUID } from 'crypto'
import type { Job, JobKind } from '../domain/Job'
import { validateJob } from '../domain/Job'
import type { JobRepository } from '../ports/JobRepository'
import type { JobRunner } from '../ports/JobRunner'

export interface EnqueueJobInput {
  kind: JobKind
  input: unknown
  userId: string
  workspaceId: string | null
  metadata?: Record<string, unknown>
  /** Se fornecido, usa este id em vez de gerar um novo (para retry/idempotência). */
  id?: string
}

/**
 * Cria um Job em status `queued`, persiste e publica no runner.
 *
 * Fluxo:
 *   1. Valida input via domain.
 *   2. Persiste (repo.upsert).
 *   3. Dispara runner.enqueue — se falhar, o job fica persistido em `queued`
 *      e pode ser reprocessado depois.
 *
 * O runner NÃO executa inline — só publica o evento. Execução real
 * acontece no worker (Inngest function), que chama `markRunning`, etc.
 */
export async function enqueueJob(
  deps: { repo: JobRepository; runner: JobRunner },
  input: EnqueueJobInput,
): Promise<Job> {
  const now = new Date().toISOString()
  const job: Job = validateJob({
    id: input.id ?? randomUUID(),
    kind: input.kind,
    status: 'queued',
    input: input.input,
    attempts: 0,
    userId: input.userId,
    workspaceId: input.workspaceId,
    metadata: input.metadata,
    createdAt: now,
    updatedAt: now,
  })

  await deps.repo.upsert(job)

  await deps.runner.enqueue({
    jobId: job.id,
    kind: job.kind,
    input: job.input,
    userId: job.userId,
    workspaceId: job.workspaceId,
  })

  return job
}
