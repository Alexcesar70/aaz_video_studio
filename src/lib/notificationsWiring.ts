/**
 * Helpers de wiring que conectam o módulo `notifications` à infra
 * Inngest pra envio assíncrono de emails.
 *
 * Padrão:
 *   import { notifyAndQueueEmail } from '@/lib/notificationsWiring'
 *
 *   await notifyAndQueueEmail({
 *     kind: 'wallet_low_balance',
 *     level: 'warning',
 *     userId: user.id,
 *     workspaceId: user.organizationId,
 *     title: 'Saldo baixo',
 *     body: `Sua wallet tem $${balance.toFixed(2)} restantes.`,
 *     link: { href: '/admin/wallet', label: 'Adicionar créditos' },
 *   })
 *
 * O que acontece:
 *   1. Notification persiste no Redis (visível no in-app sino).
 *   2. Evento Inngest `aaz/notification.email.requested` é
 *      publicado.
 *   3. A função `sendNotificationEmailFunction` consome e envia
 *      via EmailNotificationSender (Resend ou Console por env).
 *
 * Falha em qualquer ponto NÃO desfaz o anterior — notification
 * fica visível mesmo se Inngest publish falhar (caso raro). Erros
 * são logados via reportError.
 */

import {
  createNotification,
  RedisNotificationRepository,
  type CreateNotificationInput,
  type Notification,
} from '@/modules/notifications'
import { inngest } from '@/inngest/client'
import {
  NOTIFICATION_EVENT_NAMES,
  type NotificationEventData,
} from '@/inngest/events'
import { reportError } from '@/lib/errorReporter'

/**
 * Persiste a Notification e publica evento Inngest pra envio
 * assíncrono de email.
 *
 * Returns: a Notification persistida.
 */
export async function notifyAndQueueEmail(
  input: CreateNotificationInput,
): Promise<Notification> {
  const repo = new RedisNotificationRepository()
  const notification = await createNotification({ repo }, input)

  // Best-effort enqueue. Falha não bloqueia retorno.
  try {
    const data: NotificationEventData = { notificationId: notification.id }
    await inngest.send({
      name: NOTIFICATION_EVENT_NAMES.email,
      data: data as unknown as Record<string, unknown>,
    })
  } catch (err) {
    reportError(err, {
      tags: { feature: 'notifications', stage: 'enqueue_email' },
      extra: { notificationId: notification.id, kind: notification.kind },
      fingerprint: ['notification-enqueue', notification.kind],
    })
  }

  return notification
}

/**
 * Variante "store-only" — persiste a notificação SEM disparar
 * envio externo. Usado quando o canal externo não faz sentido
 * (ex.: notificações puramente in-app, baixíssima prioridade).
 */
export async function notifyInAppOnly(
  input: CreateNotificationInput,
): Promise<Notification> {
  const repo = new RedisNotificationRepository()
  return createNotification({ repo }, input)
}
