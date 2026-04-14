/**
 * Public API do módulo `jobs`.
 *
 * Código fora deste módulo deve importar APENAS deste arquivo —
 * nunca de subpastas internas.
 *
 * Pattern:
 *   import { enqueueJob, RedisJobRepository } from '@/modules/jobs'
 *
 * Escopo da entrega (M2-PR1): foundation de job tracking — módulo puro,
 * repositório Redis, runner de testes, rota GET /api/jobs/[id]. Zero
 * mudança de comportamento no resto do sistema.
 *
 * Escopo do M2-PR2: adaptador Inngest como JobRunner de produção +
 * wiring em /api/generate atrás da flag USE_ASYNC_GENERATION.
 */

// Domain (tipos + validações puras)
export type {
  Job,
  JobKind,
  JobStatus,
  JobError,
} from './domain/Job'
export {
  JOB_KINDS,
  JOB_STATUSES,
  VALID_TRANSITIONS,
  validateJob,
  canTransition,
  transition,
  InvalidJobError,
  InvalidJobTransitionError,
} from './domain/Job'

// Ports (contratos)
export type {
  JobRepository,
  JobListFilter,
} from './ports/JobRepository'
export type {
  JobRunner,
  EnqueuePayload,
} from './ports/JobRunner'

// Infra (implementações concretas)
export { RedisJobRepository } from './infra/RedisJobRepository'
export { InMemoryJobRepository } from './infra/InMemoryJobRepository'
export { NoopJobRunner, RecordingJobRunner } from './infra/NoopJobRunner'
export { InngestJobRunner } from './infra/InngestJobRunner'
export type {
  InngestLikeClient,
  EventNameResolver,
} from './infra/InngestJobRunner'

// Use cases
export { enqueueJob } from './usecases/enqueueJob'
export type { EnqueueJobInput } from './usecases/enqueueJob'
export {
  getJob,
  JobNotFoundError,
  JobAccessDeniedError,
} from './usecases/getJob'
export type { GetJobInput } from './usecases/getJob'
export { listJobs } from './usecases/listJobs'
export { markRunning } from './usecases/markRunning'
export { markCompleted } from './usecases/markCompleted'
export { markFailed } from './usecases/markFailed'
export { updateProgress } from './usecases/updateProgress'
