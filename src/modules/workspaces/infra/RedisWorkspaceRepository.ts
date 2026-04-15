/**
 * RedisWorkspaceRepository — adapter envolvendo o storage legado
 * (`@/lib/organizations.ts`) no contrato `WorkspaceRepository`.
 *
 * Existe APENAS durante a migração (M4). Será removido junto com o
 * caminho legado quando `USE_POSTGRES_WORKSPACES` estiver global e
 * estável por 30+ dias.
 */

import { getRedis } from '@/lib/redis'
import type { Workspace } from '../domain/Workspace'
import type {
  WorkspaceRepository,
  WorkspaceListFilter,
} from '../ports/WorkspaceRepository'

const ORG_PREFIX = 'aaz:org:'
const ORG_SLUG_INDEX = 'aaz:org_slug:'

function fromRedis(raw: string): Workspace | null {
  try {
    return JSON.parse(raw) as Workspace
  } catch {
    return null
  }
}

export class RedisWorkspaceRepository implements WorkspaceRepository {
  async findById(id: string): Promise<Workspace | null> {
    const redis = await getRedis()
    const raw = await redis.get(`${ORG_PREFIX}${id}`)
    return raw ? fromRedis(raw) : null
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    const redis = await getRedis()
    const id = await redis.get(`${ORG_SLUG_INDEX}${slug}`)
    if (!id) return null
    return this.findById(id)
  }

  async list(filter?: WorkspaceListFilter): Promise<Workspace[]> {
    const redis = await getRedis()
    const keys = await redis.keys(`${ORG_PREFIX}*`)
    const items: Workspace[] = []
    for (const key of keys) {
      const raw = await redis.get(key)
      if (!raw) continue
      const ws = fromRedis(raw)
      if (!ws) continue
      if (filter?.status && ws.status !== filter.status) continue
      if (filter?.ownerId && ws.ownerId !== filter.ownerId) continue
      items.push(ws)
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (filter?.limit && filter.limit > 0) return items.slice(0, filter.limit)
    return items
  }

  async upsert(ws: Workspace): Promise<Workspace> {
    const redis = await getRedis()
    // Mantém slug index sincronizado
    const prevRaw = await redis.get(`${ORG_PREFIX}${ws.id}`)
    if (prevRaw) {
      const prev = fromRedis(prevRaw)
      if (prev && prev.slug !== ws.slug) {
        await redis.del(`${ORG_SLUG_INDEX}${prev.slug}`)
      }
    }
    const conflictId = await redis.get(`${ORG_SLUG_INDEX}${ws.slug}`)
    if (conflictId && conflictId !== ws.id) {
      throw new Error(
        `Slug ${ws.slug} já pertence ao workspace ${conflictId}`,
      )
    }
    await redis.set(`${ORG_PREFIX}${ws.id}`, JSON.stringify(ws))
    await redis.set(`${ORG_SLUG_INDEX}${ws.slug}`, ws.id)
    return ws
  }

  async remove(id: string): Promise<void> {
    const redis = await getRedis()
    const raw = await redis.get(`${ORG_PREFIX}${id}`)
    if (raw) {
      const ws = fromRedis(raw)
      if (ws) await redis.del(`${ORG_SLUG_INDEX}${ws.slug}`)
    }
    await redis.del(`${ORG_PREFIX}${id}`)
  }
}
