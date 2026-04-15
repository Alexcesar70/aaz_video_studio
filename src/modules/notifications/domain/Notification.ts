/**
 * Notification — entidade de domínio.
 *
 * Representa uma notificação destinada a um user (in-app + email
 * + webhook se inscrito). É escrita pelo backend quando algum
 * evento dispara (wallet baixa, episode aprovado, scene gerada,
 * etc.) e lida pelo frontend (sino de notificações).
 *
 * Canais de entrega são responsabilidade da infra (NotificationSender
 * port + adapters Email/InApp/Webhook). O domain modela apenas
 * O QUE foi notificado.
 *
 * Regras invariantes:
 *   - id: uuid v4.
 *   - kind: union tipado ∈ NOTIFICATION_KINDS.
 *   - level: 'info' | 'warning' | 'critical' (controla badge UI).
 *   - userId é obrigatório (notificações são SEMPRE para alguém
 *     específico — broadcast pra workspace usa uma notificação
 *     por user).
 *   - workspaceId é opcional (notificações de sistema, ex.: admin
 *     global, podem não ter workspace associado).
 *   - readAt é null até user marcar como lida.
 *
 * Este módulo é PURO — sem I/O.
 */

export type NotificationKind =
  | 'wallet_low_balance'        // saldo < threshold
  | 'wallet_topped_up'           // admin adicionou créditos
  | 'wallet_spent'               // débito significativo (acima de X)
  | 'scene_approved'             // admin aprovou cena
  | 'scene_rejected'             // admin rejeitou cena
  | 'episode_review_requested'   // creator submeteu episódio pra review
  | 'episode_approved'           // admin aprovou entrega final
  | 'episode_needs_changes'      // admin pediu mudanças
  | 'job_failed'                 // geração assíncrona quebrou
  | 'job_completed'              // geração assíncrona terminou
  | 'workspace_invitation'       // user convidado pra workspace
  | 'system_announcement'        // mensagem geral do sistema

export const NOTIFICATION_KINDS: readonly NotificationKind[] = [
  'wallet_low_balance',
  'wallet_topped_up',
  'wallet_spent',
  'scene_approved',
  'scene_rejected',
  'episode_review_requested',
  'episode_approved',
  'episode_needs_changes',
  'job_failed',
  'job_completed',
  'workspace_invitation',
  'system_announcement',
] as const

export type NotificationLevel = 'info' | 'warning' | 'critical'

export const NOTIFICATION_LEVELS: readonly NotificationLevel[] = [
  'info',
  'warning',
  'critical',
] as const

export interface NotificationLink {
  /** Path interno (ex.: '/studio?episode=ep-123') ou URL completa. */
  href: string
  /** Texto do CTA. */
  label: string
}

export interface Notification {
  id: string
  kind: NotificationKind
  level: NotificationLevel
  userId: string
  workspaceId: string | null
  /** Título curto (≤80 chars). */
  title: string
  /** Corpo em texto (≤500 chars). Sem HTML. */
  body: string
  /** Link opcional pra ação. */
  link?: NotificationLink
  /** Metadata específica do kind (jobId, episodeId, amount, etc.). */
  metadata?: Record<string, unknown>
  /** ISO 8601 quando lida; null = não lida. */
  readAt: string | null
  createdAt: string
}

export class InvalidNotificationError extends Error {
  constructor(message: string) {
    super(`Invalid Notification: ${message}`)
    this.name = 'InvalidNotificationError'
  }
}

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_TITLE = 80
const MAX_BODY = 500

export function validateNotification(
  input: Partial<Notification>,
): Notification {
  if (!input.id || typeof input.id !== 'string') {
    throw new InvalidNotificationError('id é obrigatório')
  }
  if (!UUID_V4_REGEX.test(input.id)) {
    throw new InvalidNotificationError(`id inválido "${input.id}" — deve ser uuid v4`)
  }
  if (!input.kind || !NOTIFICATION_KINDS.includes(input.kind)) {
    throw new InvalidNotificationError(`kind inválido: ${String(input.kind)}`)
  }
  if (!input.level || !NOTIFICATION_LEVELS.includes(input.level)) {
    throw new InvalidNotificationError(`level inválido: ${String(input.level)}`)
  }
  if (typeof input.userId !== 'string' || input.userId.length === 0) {
    throw new InvalidNotificationError('userId é obrigatório')
  }
  if (
    input.workspaceId !== null &&
    (typeof input.workspaceId !== 'string' || input.workspaceId.length === 0)
  ) {
    throw new InvalidNotificationError('workspaceId deve ser string ou null')
  }
  if (typeof input.title !== 'string' || input.title.trim().length === 0) {
    throw new InvalidNotificationError('title é obrigatório')
  }
  if (input.title.length > MAX_TITLE) {
    throw new InvalidNotificationError(
      `title excede ${MAX_TITLE} chars (${input.title.length})`,
    )
  }
  if (typeof input.body !== 'string' || input.body.length === 0) {
    throw new InvalidNotificationError('body é obrigatório')
  }
  if (input.body.length > MAX_BODY) {
    throw new InvalidNotificationError(
      `body excede ${MAX_BODY} chars (${input.body.length})`,
    )
  }
  if (input.link !== undefined) {
    if (
      !input.link.href ||
      !input.link.label ||
      typeof input.link.href !== 'string' ||
      typeof input.link.label !== 'string'
    ) {
      throw new InvalidNotificationError('link requer href e label strings')
    }
  }

  return {
    id: input.id,
    kind: input.kind,
    level: input.level,
    userId: input.userId,
    workspaceId: input.workspaceId,
    title: input.title.trim(),
    body: input.body,
    link: input.link,
    metadata: input.metadata,
    readAt: input.readAt ?? null,
    createdAt: input.createdAt ?? new Date().toISOString(),
  }
}

/**
 * Marca como lida — operação pura (não toca persistência).
 * Idempotente: aplicar 2x mantém o readAt original.
 */
export function markRead(notification: Notification): Notification {
  if (notification.readAt) return notification
  return { ...notification, readAt: new Date().toISOString() }
}
