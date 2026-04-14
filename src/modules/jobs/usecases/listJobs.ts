import type { Job } from '../domain/Job'
import type {
  JobRepository,
  JobListFilter,
} from '../ports/JobRepository'

/**
 * Lista jobs aplicando filtros. Pass-through para o repo, mantido como
 * use case para consistência de API e futura adição de regras (ex.:
 * redact payload por permissão).
 */
export async function listJobs(
  deps: { repo: JobRepository },
  filter?: JobListFilter,
): Promise<Job[]> {
  return deps.repo.list(filter)
}
