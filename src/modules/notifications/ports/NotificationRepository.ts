import type {
  Notification,
  NotificationKind,
  NotificationLevel,
} from '../domain/Notification'

export interface NotificationListFilter {
  userId: string
  /** undefined = todas; true = só não-lidas; false = só lidas. */
  unreadOnly?: boolean
  kind?: NotificationKind
  level?: NotificationLevel
  /** Apenas notificações criadas após este ISO. */
  since?: string
  limit?: number
}

export interface NotificationRepository {
  findById(id: string): Promise<Notification | null>

  /** Lista por user (sempre filtra por userId obrigatoriamente). */
  list(filter: NotificationListFilter): Promise<Notification[]>

  /** Contagem rápida de não-lidas (pra badge do sino). */
  countUnread(userId: string): Promise<number>

  /** Insere ou atualiza. Implementação pode aplicar TTL pra notificações
   * antigas — recomenda-se 90 dias após `readAt`. */
  upsert(notification: Notification): Promise<Notification>

  /** Marca uma como lida. No-op se já estava lida. */
  markRead(id: string, userId: string): Promise<Notification | null>

  /** Marca TODAS as não-lidas do user como lidas. Retorna count afetado. */
  markAllRead(userId: string): Promise<number>

  /** Remove notificação. Authorization é responsabilidade do caller. */
  remove(id: string, userId: string): Promise<void>
}
