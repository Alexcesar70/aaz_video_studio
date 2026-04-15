import type { Notification } from '../domain/Notification'
import { validateNotification, markRead as domainMarkRead } from '../domain/Notification'
import type {
  NotificationRepository,
  NotificationListFilter,
} from '../ports/NotificationRepository'

export class InMemoryNotificationRepository implements NotificationRepository {
  private store = new Map<string, Notification>()

  async findById(id: string): Promise<Notification | null> {
    return this.store.get(id) ?? null
  }

  async list(filter: NotificationListFilter): Promise<Notification[]> {
    let items = Array.from(this.store.values()).filter(
      (n) => n.userId === filter.userId,
    )
    if (filter.unreadOnly === true) items = items.filter((n) => !n.readAt)
    if (filter.unreadOnly === false) items = items.filter((n) => !!n.readAt)
    if (filter.kind) items = items.filter((n) => n.kind === filter.kind)
    if (filter.level) items = items.filter((n) => n.level === filter.level)
    if (filter.since) items = items.filter((n) => n.createdAt >= filter.since!)
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (filter.limit && filter.limit > 0) items = items.slice(0, filter.limit)
    return items
  }

  async countUnread(userId: string): Promise<number> {
    let count = 0
    Array.from(this.store.values()).forEach((n) => {
      if (n.userId === userId && !n.readAt) count++
    })
    return count
  }

  async upsert(notification: Notification): Promise<Notification> {
    const validated = validateNotification(notification)
    this.store.set(validated.id, validated)
    return validated
  }

  async markRead(
    id: string,
    userId: string,
  ): Promise<Notification | null> {
    const n = this.store.get(id)
    if (!n) return null
    if (n.userId !== userId) return null // auth fail = silent null
    if (n.readAt) return n
    const updated = domainMarkRead(n)
    this.store.set(id, updated)
    return updated
  }

  async markAllRead(userId: string): Promise<number> {
    let count = 0
    Array.from(this.store.entries()).forEach(([id, n]) => {
      if (n.userId === userId && !n.readAt) {
        this.store.set(id, domainMarkRead(n))
        count++
      }
    })
    return count
  }

  async remove(id: string, userId: string): Promise<void> {
    const n = this.store.get(id)
    if (n && n.userId === userId) {
      this.store.delete(id)
    }
  }

  clear(): void {
    this.store.clear()
  }

  size(): number {
    return this.store.size
  }
}
