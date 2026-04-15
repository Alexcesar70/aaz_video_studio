import type { Job } from '../domain/Job'
import { validateJob } from '../domain/Job'
import type {
  JobRepository,
  JobListFilter,
} from '../ports/JobRepository'

/**
 * Repository in-memory para testes unitários e dev offline.
 * NÃO usar em produção — não persiste entre restarts.
 */
export class InMemoryJobRepository implements JobRepository {
  private store = new Map<string, Job>()

  async findById(id: string): Promise<Job | null> {
    return this.store.get(id) ?? null
  }

  async list(filter?: JobListFilter): Promise<Job[]> {
    let jobs = Array.from(this.store.values())

    if (filter?.userId) {
      jobs = jobs.filter((j) => j.userId === filter.userId)
    }
    if (filter?.workspaceId !== undefined) {
      jobs = jobs.filter((j) => j.workspaceId === filter.workspaceId)
    }
    if (filter?.kind) {
      jobs = jobs.filter((j) => j.kind === filter.kind)
    }
    if (filter?.status) {
      jobs = jobs.filter((j) => j.status === filter.status)
    }
    if (filter?.since) {
      jobs = jobs.filter((j) => j.createdAt >= filter.since!)
    }

    // Mais recente primeiro
    jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    if (filter?.limit && filter.limit > 0) {
      jobs = jobs.slice(0, filter.limit)
    }
    return jobs
  }

  async upsert(job: Job): Promise<Job> {
    const validated = validateJob(job)
    this.store.set(validated.id, validated)
    return validated
  }

  async remove(id: string): Promise<void> {
    this.store.delete(id)
  }

  /** Helper para testes: limpa o store. */
  clear(): void {
    this.store.clear()
  }

  /** Helper para testes: retorna tamanho atual. */
  size(): number {
    return this.store.size
  }
}
