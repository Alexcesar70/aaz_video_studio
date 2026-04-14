import type { Job } from '../domain/Job'
import { transition } from '../domain/Job'
import type { JobRepository } from '../ports/JobRepository'
import { JobNotFoundError } from './getJob'

/**
 * Transição queued → running. Incrementa `attempts` e seta `startedAt`.
 * Chamado pelo worker (Inngest function) no início do processamento.
 */
export async function markRunning(
  deps: { repo: JobRepository },
  input: { id: string },
): Promise<Job> {
  const current = await deps.repo.findById(input.id)
  if (!current) throw new JobNotFoundError(input.id)

  const next = transition(current, 'running')
  return deps.repo.upsert(next)
}
