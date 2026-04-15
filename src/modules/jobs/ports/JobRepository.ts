import type { Job, JobKind, JobStatus } from '../domain/Job'

/**
 * Contrato de persistência de Job.
 *
 * Implementações:
 *   - infra/RedisJobRepository (produção)
 *   - infra/InMemoryJobRepository (testes + dev offline)
 *
 * Escopo: um Job sempre pertence a um user + (opcionalmente) workspace.
 * A rota de polling filtra pelo owner — repo só persiste.
 */
export interface JobListFilter {
  userId?: string
  workspaceId?: string | null // null = jobs de sistema, undefined = não filtra
  kind?: JobKind
  status?: JobStatus
  /** Se presente, retorna apenas jobs criados após esta data (ISO 8601). */
  since?: string
  /** Limite de resultados (default: implementação decide, recomendado 50). */
  limit?: number
}

export interface JobRepository {
  /** Retorna o job por id ou null. */
  findById(id: string): Promise<Job | null>

  /** Lista jobs com filtros opcionais. Ordem: mais recente primeiro. */
  list(filter?: JobListFilter): Promise<Job[]>

  /**
   * Insere ou atualiza. Implementação é responsável por:
   *   - manter índices (por user/workspace) atualizados
   *   - aplicar TTL em status terminais (completed/failed/canceled)
   */
  upsert(job: Job): Promise<Job>

  /** Remove job. No-op se não existir. */
  remove(id: string): Promise<void>
}
