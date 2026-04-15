import { randomUUID } from 'crypto'
import type { NotificationKind } from '@/modules/notifications'
import type { WebhookSubscription } from '../domain/WebhookSubscription'
import {
  validateWebhookSubscription,
  toPublic,
  type PublicWebhookSubscription,
} from '../domain/WebhookSubscription'
import { generateWebhookSecret } from '../domain/signing'
import type {
  WebhookSubscriptionRepository,
  WebhookListFilter,
} from '../ports/WebhookSubscriptionRepository'

export class WebhookSubscriptionNotFoundError extends Error {
  constructor(id: string) {
    super(`WebhookSubscription not found: ${id}`)
    this.name = 'WebhookSubscriptionNotFoundError'
  }
}

export interface SubscribeWebhookInput {
  workspaceId: string
  url: string
  description?: string
  /** Vazio = todos os kinds. */
  kinds?: NotificationKind[]
  createdBy?: string
  /** Apenas em dev — permite http://. */
  allowInsecureUrl?: boolean
}

export interface SubscribeWebhookResult {
  /** Subscription incluindo o secret — só visível UMA vez. */
  subscription: WebhookSubscription
  /** Reminder: não mostre o secret em outros contextos. */
  secret: string
}

/**
 * Cria nova subscription. Gera secret aleatório (32 bytes hex) que
 * deve ser exibido ao usuário UMA vez no response.
 */
export async function subscribeWebhook(
  deps: { repo: WebhookSubscriptionRepository },
  input: SubscribeWebhookInput,
): Promise<SubscribeWebhookResult> {
  const secret = generateWebhookSecret()
  const sub = validateWebhookSubscription(
    {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      url: input.url,
      description: input.description,
      secret,
      kinds: input.kinds ?? [],
      active: true,
      createdBy: input.createdBy,
      consecutiveFailures: 0,
      lastDeliveryAt: null,
      lastDeliveryStatus: null,
    },
    { allowInsecureUrl: input.allowInsecureUrl },
  )
  const saved = await deps.repo.upsert(sub)
  return { subscription: saved, secret }
}

export async function unsubscribeWebhook(
  deps: { repo: WebhookSubscriptionRepository },
  id: string,
): Promise<void> {
  await deps.repo.remove(id)
}

export async function listWebhookSubscriptions(
  deps: { repo: WebhookSubscriptionRepository },
  filter?: WebhookListFilter,
): Promise<PublicWebhookSubscription[]> {
  const subs = await deps.repo.list(filter)
  return subs.map(toPublic)
}

export async function getWebhookSubscription(
  deps: { repo: WebhookSubscriptionRepository },
  id: string,
): Promise<PublicWebhookSubscription | null> {
  const s = await deps.repo.findById(id)
  return s ? toPublic(s) : null
}

export interface UpdateWebhookInput {
  id: string
  url?: string
  description?: string
  kinds?: NotificationKind[]
  active?: boolean
  /** Apenas em dev. */
  allowInsecureUrl?: boolean
}

export async function updateWebhookSubscription(
  deps: { repo: WebhookSubscriptionRepository },
  input: UpdateWebhookInput,
): Promise<PublicWebhookSubscription> {
  const current = await deps.repo.findById(input.id)
  if (!current) throw new WebhookSubscriptionNotFoundError(input.id)

  const next = validateWebhookSubscription(
    {
      ...current,
      url: input.url ?? current.url,
      description: input.description ?? current.description,
      kinds: input.kinds ?? current.kinds,
      active: input.active ?? current.active,
      // Reset failure counter quando reativada manualmente
      consecutiveFailures:
        input.active === true ? 0 : current.consecutiveFailures,
      updatedAt: new Date().toISOString(),
    },
    { allowInsecureUrl: input.allowInsecureUrl },
  )
  const saved = await deps.repo.upsert(next)
  return toPublic(saved)
}

/** Re-rolla o secret. Retorna o novo secret pra exibir UMA vez. */
export async function rotateWebhookSecret(
  deps: { repo: WebhookSubscriptionRepository },
  id: string,
): Promise<{ subscription: WebhookSubscription; newSecret: string }> {
  const current = await deps.repo.findById(id)
  if (!current) throw new WebhookSubscriptionNotFoundError(id)
  const newSecret = generateWebhookSecret()
  const saved = await deps.repo.upsert({
    ...current,
    secret: newSecret,
    updatedAt: new Date().toISOString(),
  })
  return { subscription: saved, newSecret }
}
