import type { Job } from '../domain/Job'
import { validateJob } from '../domain/Job'
import type { JobRepository } from '../ports/JobRepository'
import { JobNotFoundError } from './getJob'

/**
 * Atualiza apenas o campo `progress` (0-100) de um job em andamento.
 * Se o job não está em `running`, é no-op (não lança) — isso evita races
 * entre heartbeat e transição final.
 */
export async function updateProgress(
  deps: { repo: JobRepository },
  input: { id: string; progress: number },
): Promise<Job> {
  const current = await deps.repo.findById(input.id)
  if (!current) throw new JobNotFoundError(input.id)

  if (current.status !== 'running') return current

  const next = validateJob({
    ...current,
    progress: input.progress,
    updatedAt: new Date().toISOString(),
  })
  return deps.repo.upsert(next)
}
