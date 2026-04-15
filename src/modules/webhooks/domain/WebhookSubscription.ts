/**
 * WebhookSubscription — endpoint externo registrado por um workspace
 * para receber callbacks quando notifications de certos kinds
 * acontecem.
 *
 * Modelo:
 *   - Workspace owner cria via UI/API: { url, kinds[], description? }.
 *   - Sistema gera um `secret` (32 bytes random) usado pra HMAC-SHA256
 *     dos payloads. Owner copia o secret UMA vez (não mostra de novo).
 *   - Quando uma Notification do kind X é criada e o workspace tem
 *     subscription ativa pra esse kind, sistema POSTa para o `url`
 *     com header `X-Webhook-Signature: sha256=<hex>`.
 *   - Endpoint externo valida HMAC com o secret + processa.
 *
 * Regras invariantes:
 *   - id: uuid v4.
 *   - workspaceId: obrigatório (subscriptions são per-workspace).
 *   - url: precisa ser https://… em produção (rejeita http: a menos
 *     que `allowInsecureUrl=true`).
 *   - secret: hex de 64 chars (32 bytes).
 *   - kinds[]: array de NotificationKind. Vazio = todos.
 *   - active: subscription pode ser pausada sem deletar (audit trail).
 */

import type { NotificationKind } from '@/modules/notifications'

export interface WebhookSubscription {
  id: string
  workspaceId: string
  /** URL HTTPS pública do endpoint externo. */
  url: string
  /** Descrição opcional (ex.: "Zapier integration", "Slack bot"). */
  description?: string
  /** Hex string de 64 chars. NUNCA exposto em listings públicos. */
  secret: string
  /**
   * Filtro de kinds. Array vazio significa "TODOS" (subscribe all).
   * Caso contrário, só dispara para kinds listados.
   */
  kinds: NotificationKind[]
  active: boolean
  createdBy?: string
  createdAt: string
  updatedAt: string
  /** Última tentativa (ISO 8601). null = nunca disparou. */
  lastDeliveryAt: string | null
  /** Status da última tentativa: 'success' | 'failed' | null. */
  lastDeliveryStatus: 'success' | 'failed' | null
  /** Contador de falhas consecutivas (reset em sucesso). */
  consecutiveFailures: number
}

export class InvalidWebhookSubscriptionError extends Error {
  constructor(message: string) {
    super(`Invalid WebhookSubscription: ${message}`)
    this.name = 'InvalidWebhookSubscriptionError'
  }
}

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const SECRET_HEX_REGEX = /^[0-9a-f]{64}$/

export interface ValidateOptions {
  /** Permite http: (apenas em dev). Default: false. */
  allowInsecureUrl?: boolean
}

export function validateWebhookSubscription(
  input: Partial<WebhookSubscription>,
  options: ValidateOptions = {},
): WebhookSubscription {
  if (!input.id || !UUID_V4_REGEX.test(input.id)) {
    throw new InvalidWebhookSubscriptionError(
      `id inválido — deve ser uuid v4`,
    )
  }
  if (
    typeof input.workspaceId !== 'string' ||
    input.workspaceId.length === 0
  ) {
    throw new InvalidWebhookSubscriptionError('workspaceId é obrigatório')
  }
  if (typeof input.url !== 'string' || input.url.length === 0) {
    throw new InvalidWebhookSubscriptionError('url é obrigatório')
  }
  let parsedUrl: URL
  try {
    parsedUrl = new URL(input.url)
  } catch {
    throw new InvalidWebhookSubscriptionError(`url malformada: ${input.url}`)
  }
  if (parsedUrl.protocol === 'http:' && !options.allowInsecureUrl) {
    throw new InvalidWebhookSubscriptionError(
      'url deve usar https:// (use allowInsecureUrl em dev)',
    )
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new InvalidWebhookSubscriptionError(
      `protocolo inválido: ${parsedUrl.protocol}`,
    )
  }
  if (typeof input.secret !== 'string' || !SECRET_HEX_REGEX.test(input.secret)) {
    throw new InvalidWebhookSubscriptionError(
      'secret deve ser hex string de 64 chars (32 bytes)',
    )
  }
  if (input.kinds !== undefined && !Array.isArray(input.kinds)) {
    throw new InvalidWebhookSubscriptionError('kinds deve ser array')
  }
  if (typeof input.active !== 'boolean') {
    throw new InvalidWebhookSubscriptionError('active deve ser boolean')
  }
  if (
    typeof input.consecutiveFailures !== 'number' ||
    input.consecutiveFailures < 0 ||
    !Number.isInteger(input.consecutiveFailures)
  ) {
    throw new InvalidWebhookSubscriptionError(
      'consecutiveFailures deve ser inteiro >= 0',
    )
  }

  const now = new Date().toISOString()
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    url: input.url,
    description: input.description?.trim(),
    secret: input.secret,
    kinds: input.kinds ?? [],
    active: input.active,
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    lastDeliveryAt: input.lastDeliveryAt ?? null,
    lastDeliveryStatus: input.lastDeliveryStatus ?? null,
    consecutiveFailures: input.consecutiveFailures,
  }
}

/**
 * Verifica se a subscription deveria receber notification de um kind
 * específico. Se kinds está vazio, recebe todos.
 */
export function shouldDeliver(
  subscription: WebhookSubscription,
  kind: NotificationKind,
): boolean {
  if (!subscription.active) return false
  if (subscription.kinds.length === 0) return true
  return subscription.kinds.includes(kind)
}

/**
 * Shape do que é exposto em listings públicos (sem o secret).
 */
export type PublicWebhookSubscription = Omit<WebhookSubscription, 'secret'>

export function toPublic(
  s: WebhookSubscription,
): PublicWebhookSubscription {
  const { secret: _drop, ...rest } = s
  void _drop
  return rest
}
