import type { Job, JobError } from '../domain/Job'
import { transition } from '../domain/Job'
import type { JobRepository } from '../ports/JobRepository'
import { JobNotFoundError } from './getJob'

/**
 * Transição queued|running → failed. Anexa descrição do erro.
 * Chamado pelo worker quando a execução falha definitivamente.
 */
export async function markFailed(
  deps: { repo: JobRepository },
  input: { id: string; error: JobError },
): Promise<Job> {
  const current = await deps.repo.findById(input.id)
  if (!current) throw new JobNotFoundError(input.id)

  const next = transition(current, 'failed', { error: input.error })
  return deps.repo.upsert(next)
}
