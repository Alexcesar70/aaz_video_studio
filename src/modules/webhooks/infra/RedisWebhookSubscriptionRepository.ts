import type { WebhookSubscription } from '../domain/WebhookSubscription'
import { validateWebhookSubscription } from '../domain/WebhookSubscription'
import type {
  WebhookSubscriptionRepository,
  WebhookListFilter,
} from '../ports/WebhookSubscriptionRepository'
import { getRedis } from '@/lib/redis'

/**
 * RedisWebhookSubscriptionRepository.
 *
 * Layout:
 *   aaz:webhook:{id}                    → JSON da subscription (com secret)
 *   aaz:webhook:ws:{workspaceId}        → Set de ids da subscription
 *
 * Listagem por workspace é O(N) onde N = número de subscriptions
 * do workspace (pequeno em prática). Sem TTL — subscriptions são
 * deletadas explicitamente.
 */

const PREFIX = 'aaz:webhook:'
const WS_INDEX = 'aaz:webhook:ws:'

function key(id: string): string {
  return `${PREFIX}${id}`
}
function wsIndex(workspaceId: string): string {
  return `${WS_INDEX}${workspaceId}`
}

export class RedisWebhookSubscriptionRepository
  implements WebhookSubscriptionRepository
{
  async findById(id: string): Promise<WebhookSubscription | null> {
    const redis = await getRedis()
    const raw = await redis.get(key(id))
    if (!raw) return null
    try {
      return JSON.parse(raw) as WebhookSubscription
    } catch (err) {
      console.error('[RedisWebhookSubscriptionRepository] corrupt JSON', {
        id,
        err,
      })
      return null
    }
  }

  async list(filter?: WebhookListFilter): Promise<WebhookSubscription[]> {
    const redis = await getRedis()
    let ids: string[] = []
    if (filter?.workspaceId) {
      ids = await redis.sMembers(wsIndex(filter.workspaceId))
    } else {
      const keys = await redis.keys(`${PREFIX}*`)
      ids = keys
        .filter((k) => !k.startsWith(WS_INDEX))
        .map((k) => k.slice(PREFIX.length))
    }

    const items: WebhookSubscription[] = []
    for (const id of ids) {
      const s = await this.findById(id)
      if (!s) continue
      if (filter?.active !== undefined && s.active !== filter.active) continue
      items.push(s)
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (filter?.limit && filter.limit > 0) return items.slice(0, filter.limit)
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
    const validated = validateWebhookSubscription(subscription)
    const redis = await getRedis()
    await redis.set(key(validated.id), JSON.stringify(validated))
    await redis.sAdd(wsIndex(validated.workspaceId), validated.id)
    return validated
  }

  async remove(id: string): Promise<void> {
    const redis = await getRedis()
    const s = await this.findById(id)
    await redis.del(key(id))
    if (s) await redis.sRem(wsIndex(s.workspaceId), id)
  }
}
