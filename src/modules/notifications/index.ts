/**
 * Public API do módulo `notifications`.
 *
 * Padrão de uso típico:
 *   import { notify, RedisNotificationRepository,
 *            ConsoleNotificationSender } from '@/modules/notifications'
 *
 *   await notify(
 *     { repo: new RedisNotificationRepository(),
 *       sender: new ConsoleNotificationSender() },
 *     {
 *       kind: 'wallet_low_balance',
 *       level: 'warning',
 *       userId: user.id,
 *       workspaceId: user.workspaceId,
 *       title: 'Saldo baixo',
 *       body: `Sua wallet está com $${balance.toFixed(2)} restantes.`,
 *       link: { href: '/admin/wallet', label: 'Adicionar créditos' },
 *     }
 *   )
 */

// Domain
export type {
  Notification,
  NotificationKind,
  NotificationLevel,
  NotificationLink,
} from './domain/Notification'
export {
  validateNotification,
  markRead,
  NOTIFICATION_KINDS,
  NOTIFICATION_LEVELS,
  InvalidNotificationError,
} from './domain/Notification'

// Ports
export type {
  NotificationRepository,
  NotificationListFilter,
} from './ports/NotificationRepository'
export type { NotificationSender } from './ports/NotificationSender'

// Infra
export { InMemoryNotificationRepository } from './infra/InMemoryNotificationRepository'
export { RedisNotificationRepository } from './infra/RedisNotificationRepository'
export {
  NoopNotificationSender,
  RecordingNotificationSender,
  CompositeNotificationSender,
  ConsoleNotificationSender,
} from './infra/NotificationSenders'
export { EmailNotificationSender } from './infra/EmailNotificationSender'
export type { EmailNotificationSenderConfig } from './infra/EmailNotificationSender'
export type {
  EmailDeliverer,
  EmailMessage,
} from './ports/EmailDeliverer'
export { ConsoleEmailDeliverer, RecordingEmailDeliverer } from './infra/email/ConsoleEmailDeliverer'
export { ResendEmailDeliverer } from './infra/email/ResendEmailDeliverer'
export { buildEmailSender, DEFAULT_FROM } from './infra/email/buildEmailSender'

// Use cases
export {
  createNotification,
  notify,
  getNotification,
  listNotifications,
  countUnread,
  markNotificationRead,
  markAllNotificationsRead,
  removeNotification,
  NotificationNotFoundError,
} from './usecases/notificationOperations'
export type { CreateNotificationInput } from './usecases/notificationOperations'
