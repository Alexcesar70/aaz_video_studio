import type { Notification } from '../domain/Notification'
import {
  validateNotification,
  markRead as domainMarkRead,
} from '../domain/Notification'
import type {
  NotificationRepository,
  NotificationListFilter,
} from '../ports/NotificationRepository'
import { getRedis } from '@/lib/redis'

/**
 * Repository Redis para Notification.
 *
 * Layout de chaves:
 *   aaz:notification:{id}                       → JSON da notificação
 *   aaz:notification:user:{userId}              → Sorted Set (score=createdAt ms)
 *   aaz:notification:user:{userId}:unread       → Set de ids não-lidos
 *
 * Com esse layout, `countUnread` é O(1) (SCARD), `list` por user é
 * O(log n) (ZRANGE), e `markRead` mantém o set de não-lidos
 * sincronizado.
 *
 * TTL: notificações lidas ganham TTL de 90 dias (mantém histórico
 * por 3 meses sem crescer indefinidamente). Não-lidas não expiram.
 */

const PREFIX = 'aaz:notification:'
const USER_INDEX = 'aaz:notification:user:'
const READ_TTL_SECONDS = 90 * 24 * 60 * 60

function notifKey(id: string): string {
  return `${PREFIX}${id}`
}
function userIndex(userId: string): string {
  return `${USER_INDEX}${userId}`
}
function unreadIndex(userId: string): string {
  return `${USER_INDEX}${userId}:unread`
}

export class RedisNotificationRepository implements NotificationRepository {
  async findById(id: string): Promise<Notification | null> {
    const redis = await getRedis()
    const raw = await redis.get(notifKey(id))
    if (!raw) return null
    try {
      return JSON.parse(raw) as Notification
    } catch (err) {
      console.error('[RedisNotificationRepository] corrupt JSON', { id, err })
      return null
    }
  }

  async list(filter: NotificationListFilter): Promise<Notification[]> {
    const redis = await getRedis()
    const limit = filter.limit && filter.limit > 0 ? filter.limit : 50
    const overfetch = Math.max(limit * 3, 100)

    const ids = await redis.zRange(
      userIndex(filter.userId),
      0,
      overfetch - 1,
      { REV: true },
    )
    if (ids.length === 0) return []

    const out: Notification[] = []
    for (const id of ids) {
      const n = await this.findById(id)
      if (!n) continue
      if (filter.unreadOnly === true && n.readAt) continue
      if (filter.unreadOnly === false && !n.readAt) continue
      if (filter.kind && n.kind !== filter.kind) continue
      if (filter.level && n.level !== filter.level) continue
      if (filter.since && n.createdAt < filter.since) continue
      out.push(n)
      if (out.length >= limit) break
    }
    return out
  }

  async countUnread(userId: string): Promise<number> {
    const redis = await getRedis()
    return redis.sCard(unreadIndex(userId))
  }

  async upsert(notification: Notification): Promise<Notification> {
    const validated = validateNotification(notification)
    const redis = await getRedis()
    const key = notifKey(validated.id)
    await redis.set(key, JSON.stringify(validated))

    const score = Date.parse(validated.createdAt)
    await redis.zAdd(userIndex(validated.userId), {
      score,
      value: validated.id,
    })

    if (validated.readAt) {
      // Lida: remove do set de não-lidas + aplica TTL
      await redis.sRem(unreadIndex(validated.userId), validated.id)
      await redis.expire(key, READ_TTL_SECONDS)
    } else {
      // Não-lida: garante presença no set + sem TTL
      await redis.sAdd(unreadIndex(validated.userId), validated.id)
      await redis.persist(key)
    }
    return validated
  }

  async markRead(
    id: string,
    userId: string,
  ): Promise<Notification | null> {
    const n = await this.findById(id)
    if (!n || n.userId !== userId) return null
    if (n.readAt) return n
    const updated = domainMarkRead(n)
    return this.upsert(updated)
  }

  async markAllRead(userId: string): Promise<number> {
    const redis = await getRedis()
    const ids = await redis.sMembers(unreadIndex(userId))
    let count = 0
    for (const id of ids) {
      const updated = await this.markRead(id, userId)
      if (updated) count++
    }
    return count
  }

  async remove(id: string, userId: string): Promise<void> {
    const n = await this.findById(id)
    if (!n || n.userId !== userId) return
    const redis = await getRedis()
    await redis.del(notifKey(id))
    await redis.zRem(userIndex(userId), id)
    await redis.sRem(unreadIndex(userId), id)
  }
}
