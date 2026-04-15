import type { WebhookSubscription } from '../domain/WebhookSubscription'
import { validateWebhookSubscription } from '../domain/WebhookSubscription'
import type {
  WebhookSubscriptionRepository,
  WebhookListFilter,
} from '../ports/WebhookSubscriptionRepository'

export class InMemoryWebhookSubscriptionRepository
  implements WebhookSubscriptionRepository
{
  private store = new Map<string, WebhookSubscription>()

  async findById(id: string): Promise<WebhookSubscription | null> {
    return this.store.get(id) ?? null
  }

  async list(filter?: WebhookListFilter): Promise<WebhookSubscription[]> {
    let items = Array.from(this.store.values())
    if (filter?.workspaceId) {
      items = items.filter((s) => s.workspaceId === filter.workspaceId)
    }
    if (filter?.active !== undefined) {
      items = items.filter((s) => s.active === filter.active)
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (filter?.limit && filter.limit > 0) items = items.slice(0, filter.limit)
    return items
  }

  async listActiveForWorkspace(
    workspaceId: string,
  ): Promise<WebhookSubscription[]> {
    return this.list({ workspaceId, active: true })
  }

  async upsert(
    subscription: WebhookSubscription,
  ): Promise<WebhookSubscription> {
    const validated = validateWebhookSubscription(subscription, {
      allowInsecureUrl: true, // tests
    })
    this.store.set(validated.id, validated)
    return validated
  }

  async remove(id: string): Promise<void> {
    this.store.delete(id)
  }

  clear(): void {
    this.store.clear()
  }
}
