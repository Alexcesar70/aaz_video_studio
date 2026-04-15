import type { Job } from '../domain/Job'
import { transition } from '../domain/Job'
import type { JobRepository } from '../ports/JobRepository'
import { JobNotFoundError } from './getJob'

/**
 * Transição running → completed. Anexa `output` ao job.
 * Chamado pelo worker ao finalizar com sucesso.
 */
export async function markCompleted(
  deps: { repo: JobRepository },
  input: { id: string; output: unknown },
): Promise<Job> {
  const current = await deps.repo.findById(input.id)
  if (!current) throw new JobNotFoundError(input.id)

  const next = transition(current, 'completed', { output: input.output })
  return deps.repo.upsert(next)
}
