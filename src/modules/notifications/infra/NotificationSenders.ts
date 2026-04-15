/**
 * Adapters de NotificationSender — implementações concretas dos
 * canais de envio. Mais adapters concretos (Email, Webhook) podem
 * vir em PRs próprios; este arquivo carrega os utilitários
 * genéricos e o composite.
 */

import type { Notification } from '../domain/Notification'
import type { NotificationSender } from '../ports/NotificationSender'

/**
 * NoopNotificationSender — não envia nada. Útil em testes.
 */
export class NoopNotificationSender implements NotificationSender {
  async send(_notification: Notification): Promise<void> {
    void _notification
  }
}

/**
 * RecordingNotificationSender — grava chamadas em uma lista.
 * Para asserções em testes.
 */
export class RecordingNotificationSender implements NotificationSender {
  public readonly sent: Notification[] = []

  async send(notification: Notification): Promise<void> {
    this.sent.push(notification)
  }

  reset(): void {
    this.sent.length = 0
  }
}

/**
 * CompositeNotificationSender — fan-out para múltiplos senders.
 * Erros individuais NÃO bloqueiam outros — são capturados via
 * `reportError` (caller injeta a função pra evitar dep circular).
 */
export class CompositeNotificationSender implements NotificationSender {
  constructor(
    private readonly senders: NotificationSender[],
    private readonly onError?: (
      err: unknown,
      senderIndex: number,
      notification: Notification,
    ) => void,
  ) {}

  async send(notification: Notification): Promise<void> {
    const results = await Promise.allSettled(
      this.senders.map((s) => s.send(notification)),
    )
    results.forEach((r, idx) => {
      if (r.status === 'rejected' && this.onError) {
        this.onError(r.reason, idx, notification)
      }
    })
  }
}

/**
 * ConsoleNotificationSender — printa em JSON. Útil em dev e como
 * fallback quando nenhum vendor está plugado.
 */
export class ConsoleNotificationSender implements NotificationSender {
  async send(notification: Notification): Promise<void> {
    console.info(
      JSON.stringify({
        type: 'notification_send',
        notification: {
          id: notification.id,
          kind: notification.kind,
          level: notification.level,
          userId: notification.userId,
          title: notification.title,
        },
        ts: new Date().toISOString(),
      }),
    )
  }
}
