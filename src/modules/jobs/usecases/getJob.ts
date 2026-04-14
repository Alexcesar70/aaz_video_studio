import type { Job } from '../domain/Job'
import type { JobRepository } from '../ports/JobRepository'

export class JobNotFoundError extends Error {
  constructor(id: string) {
    super(`Job not found: ${id}`)
    this.name = 'JobNotFoundError'
  }
}

export class JobAccessDeniedError extends Error {
  constructor(id: string) {
    super(`Access denied to job: ${id}`)
    this.name = 'JobAccessDeniedError'
  }
}

export interface GetJobInput {
  id: string
  /** Se fornecido, valida que o job pertence a este user. */
  requesterUserId?: string
  /** Se fornecido, valida que o job pertence a este workspace. */
  requesterWorkspaceId?: string | null
}

/**
 * Retorna o Job, aplicando autorização opcional por user/workspace.
 * Lança JobNotFoundError ou JobAccessDeniedError conforme o caso.
 */
export async function getJob(
  deps: { repo: JobRepository },
  input: GetJobInput,
): Promise<Job> {
  const job = await deps.repo.findById(input.id)
  if (!job) {
    throw new JobNotFoundError(input.id)
  }

  if (input.requesterUserId && job.userId !== input.requesterUserId) {
    // Permite que usuários do mesmo workspace também vejam, se workspace bater.
    if (
      input.requesterWorkspaceId === undefined ||
      input.requesterWorkspaceId !== job.workspaceId
    ) {
      throw new JobAccessDeniedError(input.id)
    }
  }

  return job
}
