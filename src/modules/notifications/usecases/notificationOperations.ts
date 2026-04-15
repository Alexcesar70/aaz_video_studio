import { randomUUID } from 'crypto'
import type {
  Notification,
  NotificationKind,
  NotificationLevel,
  NotificationLink,
} from '../domain/Notification'
import { validateNotification } from '../domain/Notification'
import type {
  NotificationRepository,
  NotificationListFilter,
} from '../ports/NotificationRepository'
import type { NotificationSender } from '../ports/NotificationSender'

export class NotificationNotFoundError extends Error {
  constructor(id: string) {
    super(`Notification not found: ${id}`)
    this.name = 'NotificationNotFoundError'
  }
}

export interface CreateNotificationInput {
  kind: NotificationKind
  level: NotificationLevel
  userId: string
  workspaceId: string | null
  title: string
  body: string
  link?: NotificationLink
  metadata?: Record<string, unknown>
  /** Se fornecido, usa este id (idempotência externa). */
  id?: string
}

/**
 * Cria + persiste a notificação. Não dispara senders — quem
 * orchestra envio é `notify()` abaixo (que persiste E envia).
 */
export async function createNotification(
  deps: { repo: NotificationRepository },
  input: CreateNotificationInput,
): Promise<Notification> {
  const now = new Date().toISOString()
  const notification = validateNotification({
    id: input.id ?? randomUUID(),
    kind: input.kind,
    level: input.level,
    userId: input.userId,
    workspaceId: input.workspaceId,
    title: input.title,
    body: input.body,
    link: input.link,
    metadata: input.metadata,
    readAt: null,
    createdAt: now,
  })
  return deps.repo.upsert(notification)
}

/**
 * Persiste + envia (canal externo). Padrão recomendado para a
 * maioria dos call sites — única chamada faz tudo.
 *
 * Falha no `sender.send()` NÃO desfaz a persistência. A
 * notificação fica marcada como criada (visível no in-app) mesmo
 * que o email falhe — caller pode resender via UI.
 */
export async function notify(
  deps: { repo: NotificationRepository; sender?: NotificationSender },
  input: CreateNotificationInput,
): Promise<Notification> {
  const notification = await createNotification({ repo: deps.repo }, input)
  if (deps.sender) {
    try {
      await deps.sender.send(notification)
    } catch (err) {
      // Não propaga — quem chama notify() não quer ser bloqueado
      // por falha de canal externo. O log structured permite alarme
      // via Sentry pelo caller (que tem o context).
      console.error('[notify] sender failed', {
        notificationId: notification.id,
        kind: notification.kind,
        err: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return notification
}

export async function getNotification(
  deps: { repo: NotificationRepository },
  id: string,
): Promise<Notification | null> {
  return deps.repo.findById(id)
}

export async function listNotifications(
  deps: { repo: NotificationRepository },
  filter: NotificationListFilter,
): Promise<Notification[]> {
  return deps.repo.list(filter)
}

export async function countUnread(
  deps: { repo: NotificationRepository },
  userId: string,
): Promise<number> {
  return deps.repo.countUnread(userId)
}

export async function markNotificationRead(
  deps: { repo: NotificationRepository },
  input: { id: string; userId: string },
): Promise<Notification | null> {
  return deps.repo.markRead(input.id, input.userId)
}

export async function markAllNotificationsRead(
  deps: { repo: NotificationRepository },
  userId: string,
): Promise<number> {
  return deps.repo.markAllRead(userId)
}

export async function removeNotification(
  deps: { repo: NotificationRepository },
  input: { id: string; userId: string },
): Promise<void> {
  await deps.repo.remove(input.id, input.userId)
}
