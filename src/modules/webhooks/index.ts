/**
 * Public API do módulo `webhooks`.
 *
 * Outbound webhooks HMAC-signed para integrações externas
 * (Zapier, Make, custom endpoints). Cada workspace pode registrar
 * múltiplas subscriptions filtradas por NotificationKind.
 *
 * Padrão de uso:
 *   import {
 *     subscribeWebhook,
 *     RedisWebhookSubscriptionRepository,
 *   } from '@/modules/webhooks'
 *
 *   const { secret } = await subscribeWebhook(
 *     { repo: new RedisWebhookSubscriptionRepository() },
 *     {
 *       workspaceId: 'aaz',
 *       url: 'https://hooks.zapier.com/hooks/catch/.../',
 *       kinds: ['episode_approved', 'job_failed'],
 *       createdBy: 'alice',
 *     },
 *   )
 *   // exibir `secret` UMA vez ao usuário
 */

// Domain
export type {
  WebhookSubscription,
  PublicWebhookSubscription,
  ValidateOptions,
} from './domain/WebhookSubscription'
export {
  validateWebhookSubscription,
  shouldDeliver,
  toPublic,
  InvalidWebhookSubscriptionError,
} from './domain/WebhookSubscription'

// Signing utils
export {
  generateWebhookSecret,
  signPayload,
  verifySignature,
} from './domain/signing'

// Ports
export type {
  WebhookSubscriptionRepository,
  WebhookListFilter,
} from './ports/WebhookSubscriptionRepository'

// Infra
export { InMemoryWebhookSubscriptionRepository } from './infra/InMemoryWebhookSubscriptionRepository'
export { RedisWebhookSubscriptionRepository } from './infra/RedisWebhookSubscriptionRepository'
export { WebhookNotificationSender } from './infra/WebhookNotificationSender'
export type { WebhookNotificationSenderConfig } from './infra/WebhookNotificationSender'

// Use cases
export {
  subscribeWebhook,
  unsubscribeWebhook,
  listWebhookSubscriptions,
  getWebhookSubscription,
  updateWebhookSubscription,
  rotateWebhookSecret,
  WebhookSubscriptionNotFoundError,
} from './usecases/webhookOperations'
export type {
  SubscribeWebhookInput,
  SubscribeWebhookResult,
  UpdateWebhookInput,
} from './usecases/webhookOperations'
