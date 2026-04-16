/**
 * Helpers de wiring que conectam o módulo `notifications` ao envio
 * de email — INLINE, sem Inngest.
 *
 * Histórico: a v1 deste arquivo (M6-PR3) usava Inngest como fila
 * (`inngest.send()` → função Inngest → Resend). Essa arquitetura é
 * overkill pra volume transacional baixo e cria várias partes móveis
 * (conta Inngest, env vars, webhook sync). Pra simplificar, voltamos
 * a enviar inline: persiste notification → chama Resend direto →
 * retorna.
 *
 * Quando usar Inngest faria sentido no futuro:
 *  - Volume > 1k emails/dia (queue smoothing)
 *  - Retries com backoff exponencial obrigatórios (rate limits de vendor)
 *  - Batch / digest / send-in-window (ex.: só envia entre 9h-21h)
 *
 * Até lá, inline resolve e é mais fácil de debugar.
 *
 * Padrão de uso:
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
 *   2. Envio inline via EmailNotificationSender → ResendEmailDeliverer.
 *   3. Falha no envio NÃO desfaz persistência (notification fica
 *      acessível no in-app mesmo se email falhou).
 *   4. Erros logados via reportError com tag feature=notifications.
 */

import {
  createNotification,
  EmailNotificationSender,
  RedisNotificationRepository,
  type CreateNotificationInput,
  type Notification,
} from '@/modules/notifications'
import { ConsoleEmailDeliverer } from '@/modules/notifications/infra/email/ConsoleEmailDeliverer'
import { ResendEmailDeliverer } from '@/modules/notifications/infra/email/ResendEmailDeliverer'
import { RedisUserRepository } from '@/modules/users'
import { reportError } from '@/lib/errorReporter'

/**
 * Constrói o EmailNotificationSender conforme env vars disponíveis.
 * - RESEND_API_KEY presente → Resend real
 * - Ausente → Console (logs estruturados, útil em dev)
 */
function buildEmailSender(): EmailNotificationSender {
  const apiKey = process.env.RESEND_API_KEY
  const deliverer = apiKey
    ? new ResendEmailDeliverer({ apiKey })
    : new ConsoleEmailDeliverer()

  const userRepo = new RedisUserRepository()

  return new EmailNotificationSender({
    emailDeliverer: deliverer,
    defaultFrom:
      process.env.NOTIFICATION_FROM_EMAIL ?? 'onboarding@resend.dev',
    recipientResolver: async (userId) => {
      const u = await userRepo.findById(userId)
      return u?.email ?? null
    },
    onSkip: (n, reason) => {
      console.warn('[notifyAndQueueEmail] skipped', {
        notificationId: n.id,
        kind: n.kind,
        reason,
      })
    },
  })
}

/**
 * Persiste a Notification e envia email INLINE (não bloqueia muito —
 * Resend responde em ~500ms típico). Falha no email é capturada e
 * logada, mas não propaga — caller do notifyAndQueueEmail não deve
 * ser bloqueado por problema de canal externo.
 *
 * Retorna: a Notification persistida.
 */
export async function notifyAndQueueEmail(
  input: CreateNotificationInput,
): Promise<Notification> {
  const repo = new RedisNotificationRepository()
  const notification = await createNotification({ repo }, input)

  // Envio inline — best-effort, não bloqueia retorno se falhar.
  try {
    const sender = buildEmailSender()
    await sender.send(notification)
  } catch (err) {
    reportError(err, {
      tags: { feature: 'notifications', stage: 'inline_email' },
      extra: { notificationId: notification.id, kind: notification.kind },
      fingerprint: ['notification-inline-email', notification.kind],
    })
    // Não re-throw — notification foi persistida, user vai ver no sino
    // mesmo sem email. Caller pode resender manualmente depois.
    console.error('[notifyAndQueueEmail] email send failed', {
      notificationId: notification.id,
      err: err instanceof Error ? err.message : String(err),
    })
  }

  return notification
}

/**
 * Variante "store-only" — persiste a notificação SEM disparar envio
 * externo. Usado quando o canal externo não faz sentido (ex.:
 * notificações puramente in-app, baixíssima prioridade).
 */
export async function notifyInAppOnly(
  input: CreateNotificationInput,
): Promise<Notification> {
  const repo = new RedisNotificationRepository()
  return createNotification({ repo }, input)
}
