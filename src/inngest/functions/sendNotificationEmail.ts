/**
 * Inngest function — consome `aaz/notification.email.requested` e
 * envia o email correspondente via EmailNotificationSender.
 *
 * Arquitetura:
 *   - Persistência da Notification acontece SINCRONAMENTE em
 *     `notify()` (use case).
 *   - Se o caller quer que o email seja entregue ASSÍNCRONO (sem
 *     bloquear o response), publica este evento via inngest.send().
 *   - Inngest invoca esta função, que carrega a Notification do
 *     repo e dispara o EmailNotificationSender (Resend ou Console).
 *   - Retries automáticos do Inngest (2 retries por padrão) cuidam
 *     de falhas transitórias do provider.
 *
 * Composição runtime:
 *   - `RESEND_API_KEY` ausente → ConsoleEmailDeliverer (dev).
 *   - Presente → ResendEmailDeliverer com fetch global.
 *   - `recipientResolver` busca user via RedisUserRepository legacy
 *     (composer iria contra a fronteira já que função roda em
 *     contexto Inngest sem Next request).
 */

import {
  RedisNotificationRepository,
  EmailNotificationSender,
} from '@/modules/notifications'
import { ConsoleEmailDeliverer } from '@/modules/notifications/infra/email/ConsoleEmailDeliverer'
import { ResendEmailDeliverer } from '@/modules/notifications/infra/email/ResendEmailDeliverer'
import { RedisUserRepository } from '@/modules/users'
import { reportError } from '@/lib/errorReporter'
import { inngest } from '../client'
import { NOTIFICATION_EVENT_NAMES } from '../events'

function buildEmailSender(): EmailNotificationSender {
  const apiKey = process.env.RESEND_API_KEY
  const deliverer = apiKey
    ? new ResendEmailDeliverer({ apiKey })
    : new ConsoleEmailDeliverer()

  const userRepo = new RedisUserRepository()

  return new EmailNotificationSender({
    emailDeliverer: deliverer,
    defaultFrom:
      process.env.NOTIFICATION_FROM_EMAIL ??
      'AAZ Studio <noreply@aaz.app>',
    recipientResolver: async (userId) => {
      const u = await userRepo.findById(userId)
      return u?.email ?? null
    },
    onSkip: (n, reason) => {
      console.warn('[sendNotificationEmail] skipped', {
        notificationId: n.id,
        kind: n.kind,
        reason,
      })
    },
  })
}

export const sendNotificationEmailFunction = inngest.createFunction(
  {
    id: 'send-notification-email',
    name: 'Send Notification Email',
    retries: 2,
    triggers: [{ event: NOTIFICATION_EVENT_NAMES.email }],
  },
  async ({ event, step, logger }) => {
    const { notificationId } = event.data as { notificationId: string }
    if (!notificationId) {
      throw new Error('event.data.notificationId é obrigatório')
    }

    logger.info('[send-notification-email] start', { notificationId })

    const repo = new RedisNotificationRepository()

    const notification = await step.run('load-notification', async () => {
      return repo.findById(notificationId)
    })

    if (!notification) {
      // Notificação foi deletada antes do worker rodar — não-erro.
      logger.warn('[send-notification-email] notification not found', {
        notificationId,
      })
      return { notificationId, status: 'skipped' as const }
    }

    try {
      await step.run('send', async () => {
        const sender = buildEmailSender()
        await sender.send(notification)
      })
      logger.info('[send-notification-email] done', { notificationId })
      return { notificationId, status: 'sent' as const }
    } catch (err) {
      reportError(err, {
        tags: { feature: 'notifications', channel: 'email' },
        extra: { notificationId, kind: notification.kind },
        fingerprint: ['notification-email', notification.kind],
      })
      throw err
    }
  },
)
