import type { Notification } from '../domain/Notification'

/**
 * Contrato de envio de notificação para um canal externo (email,
 * webhook, push, etc.). Cada canal é um adapter implementando este
 * port.
 *
 * Implementações típicas:
 *   - infra/EmailNotificationSender (Resend, Postmark, etc.)
 *   - infra/WebhookNotificationSender (HMAC-signed POST)
 *   - infra/NoopNotificationSender (testes / dev)
 *   - infra/CompositeNotificationSender (fan-out para múltiplos)
 *
 * O `send` NÃO precisa ser idempotente — caller (geralmente Inngest
 * function) é quem garante delivery exactly-once via dedup keys.
 *
 * Se o canal falha, deve LANÇAR. O caller (Inngest) faz retry com
 * backoff exponencial conforme política da função.
 */
export interface NotificationSender {
  send(notification: Notification): Promise<void>
}
