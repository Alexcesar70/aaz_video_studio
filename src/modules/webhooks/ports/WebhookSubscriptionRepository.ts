import type { WebhookSubscription } from '../domain/WebhookSubscription'

export interface WebhookListFilter {
  workspaceId?: string
  active?: boolean
  limit?: number
}

export interface WebhookSubscriptionRepository {
  findById(id: string): Promise<WebhookSubscription | null>
  list(filter?: WebhookListFilter): Promise<WebhookSubscription[]>

  /**
   * Lista TODAS as subscriptions ativas de um workspace que devem
   * receber `kind`. Filtragem por kind é responsabilidade do caller
   * via `shouldDeliver(sub, kind)` — o repo retorna todas as ativas.
   */
  listActiveForWorkspace(workspaceId: string): Promise<WebhookSubscription[]>

  upsert(subscription: WebhookSubscription): Promise<WebhookSubscription>
  remove(id: string): Promise<void>
}
