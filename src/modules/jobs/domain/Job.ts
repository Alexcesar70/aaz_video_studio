/**
 * Job — entidade de domínio para operações assíncronas de longa duração.
 *
 * Substitui o modelo síncrono atual (/api/generate devolve vídeo no mesmo
 * request) por um modelo baseado em fila: quando a flag USE_ASYNC_GENERATION
 * está ligada, a rota devolve { jobId, status: 'queued' } imediatamente e
 * um worker (Inngest em produção, InMemoryJobRunner em testes) processa
 * o job em background, atualizando o status até `completed` ou `failed`.
 *
 * Regras invariantes:
 *   - id é uuid v4 (string, 36 chars).
 *   - status só pode transitar conforme o grafo `VALID_TRANSITIONS`.
 *   - createdAt é estável (nunca muda após criação).
 *   - updatedAt é monotônico crescente.
 *   - attempts é inteiro >= 0.
 *   - progress, quando presente, é 0-100.
 *   - um job em `completed` tem `output` definido e `completedAt` setado.
 *   - um job em `failed` tem `error` definido e `completedAt` setado.
 *   - workspaceId=null é permitido para jobs de sistema (ex.: admin seeds).
 *
 * Este módulo é **puro**: sem I/O, sem imports de infra.
 */

export type JobKind =
  | 'video_generation'
  | 'image_generation'
  | 'music_generation'
  | 'voice_generation'

export const JOB_KINDS: readonly JobKind[] = [
  'video_generation',
  'image_generation',
  'music_generation',
  'voice_generation',
] as const

export type JobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'canceled'

export const JOB_STATUSES: readonly JobStatus[] = [
  'queued',
  'running',
  'completed',
  'failed',
  'canceled',
] as const

/**
 * Transições válidas do grafo de estado. Qualquer outra transição lança
 * `InvalidJobTransitionError`.
 */
export const VALID_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  queued: ['running', 'canceled', 'failed'],
  running: ['completed', 'failed'],
  completed: [],
  failed: [],
  canceled: [],
}

export interface JobError {
  message: string
  code?: string
}

export interface Job {
  id: string
  kind: JobKind
  status: JobStatus
  /** Payload serializado. O shape é contrato entre quem enfileira e quem executa. */
  input: unknown
  /** Resultado serializado (presente apenas quando status='completed'). */
  output?: unknown
  /** Descrição do erro (presente apenas quando status='failed'). */
  error?: JobError
  /** Progresso reportado pelo worker (0-100). */
  progress?: number
  attempts: number
  userId: string
  workspaceId: string | null
  /** Metadata arbitrária (ex.: engineId, duration para jobs de vídeo). */
  metadata?: Record<string, unknown>
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
  startedAt?: string
  completedAt?: string
}

export class InvalidJobError extends Error {
  constructor(message: string) {
    super(`Invalid Job: ${message}`)
    this.name = 'InvalidJobError'
  }
}

export class InvalidJobTransitionError extends Error {
  public readonly from: JobStatus
  public readonly to: JobStatus
  constructor(from: JobStatus, to: JobStatus) {
    super(`Invalid Job transition: ${from} → ${to}`)
    this.name = 'InvalidJobTransitionError'
    this.from = from
    this.to = to
  }
}

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Valida shape mínimo de um Job antes de persistir.
 * Lança `InvalidJobError` em qualquer infração.
 */
export function validateJob(input: Partial<Job>): Job {
  if (!input.id || typeof input.id !== 'string') {
    throw new InvalidJobError('id é obrigatório')
  }
  if (!UUID_V4_REGEX.test(input.id)) {
    throw new InvalidJobError(`id inválido "${input.id}" — deve ser uuid v4`)
  }
  if (!input.kind || !JOB_KINDS.includes(input.kind)) {
    throw new InvalidJobError(`kind inválido: ${String(input.kind)}`)
  }
  if (!input.status || !JOB_STATUSES.includes(input.status)) {
    throw new InvalidJobError(`status inválido: ${String(input.status)}`)
  }
  if (typeof input.userId !== 'string' || input.userId.length === 0) {
    throw new InvalidJobError('userId é obrigatório')
  }
  if (
    input.workspaceId !== null &&
    (typeof input.workspaceId !== 'string' || input.workspaceId.length === 0)
  ) {
    throw new InvalidJobError('workspaceId deve ser string ou null')
  }
  if (input.input === undefined) {
    throw new InvalidJobError('input é obrigatório (use null se não houver payload)')
  }
  if (typeof input.attempts !== 'number' || input.attempts < 0 || !Number.isInteger(input.attempts)) {
    throw new InvalidJobError('attempts deve ser inteiro >= 0')
  }
  if (
    input.progress !== undefined &&
    (typeof input.progress !== 'number' || input.progress < 0 || input.progress > 100)
  ) {
    throw new InvalidJobError('progress deve estar entre 0 e 100')
  }
  if (input.status === 'completed' && input.output === undefined) {
    throw new InvalidJobError('job completed requer output')
  }
  if (input.status === 'failed' && !input.error) {
    throw new InvalidJobError('job failed requer error')
  }

  const now = new Date().toISOString()
  return {
    id: input.id,
    kind: input.kind,
    status: input.status,
    input: input.input,
    output: input.output,
    error: input.error,
    progress: input.progress,
    attempts: input.attempts,
    userId: input.userId,
    workspaceId: input.workspaceId,
    metadata: input.metadata,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  }
}

/**
 * Retorna true se a transição é válida. Útil para guards antes de chamar
 * `transition()`.
 */
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

/**
 * Aplica uma transição de status pura. Lança `InvalidJobTransitionError`
 * se a transição não é permitida.
 *
 * Regras automáticas:
 *   - transição para 'running' seta `startedAt` (se ainda não estiver).
 *   - transição para 'completed' | 'failed' | 'canceled' seta `completedAt`.
 *   - updatedAt é sempre atualizado.
 *   - attempts é incrementado em queued → running.
 */
export function transition(
  current: Job,
  to: JobStatus,
  patch: Partial<Pick<Job, 'output' | 'error' | 'progress'>> = {},
): Job {
  if (!canTransition(current.status, to)) {
    throw new InvalidJobTransitionError(current.status, to)
  }

  const now = new Date().toISOString()
  const next: Job = {
    ...current,
    ...patch,
    status: to,
    updatedAt: now,
  }

  if (to === 'running') {
    next.startedAt = current.startedAt ?? now
    next.attempts = current.attempts + 1
  }
  if (to === 'completed' || to === 'failed' || to === 'canceled') {
    next.completedAt = now
  }

  return validateJob(next)
}
