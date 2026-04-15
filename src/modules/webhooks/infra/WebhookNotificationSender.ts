/**
 * WebhookNotificationSender — adapter de NotificationSender que
 * faz POST HMAC-signed para cada subscription ativa do workspace
 * que casa com o kind da notification.
 *
 * Composição:
 *   - `repo`: WebhookSubscriptionRepository pra buscar subscriptions
 *     ativas.
 *   - `httpFetch`: fetch injetável (testes).
 *   - `onDelivery`: callback opcional para registrar
 *     `lastDeliveryStatus` + `consecutiveFailures` (atualiza repo).
 *
 * Política:
 *   - Notification SEM workspaceId → no-op (webhooks são por
 *     workspace, não há onde enviar).
 *   - Cada subscription ativa que `shouldDeliver(sub, kind)`
 *     recebe um POST. Falhas individuais NÃO bloqueiam outras
 *     (Promise.allSettled).
 *   - Subscriptions com >= 5 falhas consecutivas são auto-pausadas
 *     (active=false) — backoff agressivo.
 */

import type { Notification } from '@/modules/notifications'
import type { NotificationSender } from '@/modules/notifications'
import type { WebhookSubscription } from '../domain/WebhookSubscription'
import { shouldDeliver } from '../domain/WebhookSubscription'
import { signPayload } from '../domain/signing'
import type { WebhookSubscriptionRepository } from '../ports/WebhookSubscriptionRepository'

export interface WebhookNotificationSenderConfig {
  repo: WebhookSubscriptionRepository
  /** Fetch injetável (default: global fetch). */
  fetchImpl?: typeof fetch
  /** Timeout em ms por POST. Default: 10_000. */
  timeoutMs?: number
  /** Número máx. de falhas consecutivas antes de auto-pausar. Default: 5. */
  maxConsecutiveFailures?: number
  /** Header pra assinatura. Default: 'X-Webhook-Signature'. */
  signatureHeader?: string
  /** Header pra id da delivery (idempotency). Default: 'X-Webhook-Id'. */
  idHeader?: string
}

const DEFAULT_TIMEOUT = 10_000
const DEFAULT_MAX_FAILURES = 5

export class WebhookNotificationSender implements NotificationSender {
  private readonly repo: WebhookSubscriptionRepository
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number
  private readonly maxFailures: number
  private readonly sigHeader: string
  private readonly idHeader: string

  constructor(cfg: WebhookNotificationSenderConfig) {
    this.repo = cfg.repo
    this.fetchImpl = cfg.fetchImpl ?? fetch
    this.timeoutMs = cfg.timeoutMs ?? DEFAULT_TIMEOUT
    this.maxFailures = cfg.maxConsecutiveFailures ?? DEFAULT_MAX_FAILURES
    this.sigHeader = cfg.signatureHeader ?? 'X-Webhook-Signature'
    this.idHeader = cfg.idHeader ?? 'X-Webhook-Id'
  }

  async send(notification: Notification): Promise<void> {
    if (!notification.workspaceId) return

    const subs = await this.repo.listActiveForWorkspace(
      notification.workspaceId,
    )
    const targets = subs.filter((s) => shouldDeliver(s, notification.kind))
    if (targets.length === 0) return

    const payload = JSON.stringify({
      id: notification.id,
      kind: notification.kind,
      level: notification.level,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      metadata: notification.metadata,
      workspaceId: notification.workspaceId,
      userId: notification.userId,
      createdAt: notification.createdAt,
    })

    await Promise.allSettled(
      targets.map((sub) => this.deliverOne(sub, payload, notification.id)),
    )
  }

  private async deliverOne(
    sub: WebhookSubscription,
    payload: string,
    notificationId: string,
  ): Promise<void> {
    const signature = signPayload(payload, sub.secret)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    let success = false
    try {
      const res = await this.fetchImpl(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [this.sigHeader]: signature,
          [this.idHeader]: notificationId,
        },
        body: payload,
        signal: controller.signal,
      })
      success = res.ok
      if (!success) {
        console.warn('[webhook] non-2xx', {
          subscriptionId: sub.id,
          url: sub.url,
          status: res.status,
        })
      }
    } catch (err) {
      console.warn('[webhook] delivery failed', {
        subscriptionId: sub.id,
        url: sub.url,
        err: err instanceof Error ? err.message : String(err),
      })
    } finally {
      clearTimeout(timeout)
    }

    // Atualiza estado no repo (best-effort)
    try {
      const consecutiveFailures = success ? 0 : sub.consecutiveFailures + 1
      const active = consecutiveFailures < this.maxFailures
      await this.repo.upsert({
        ...sub,
        lastDeliveryAt: new Date().toISOString(),
        lastDeliveryStatus: success ? 'success' : 'failed',
        consecutiveFailures,
        active,
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      console.error('[webhook] failed to update sub state', err)
    }
  }
}
