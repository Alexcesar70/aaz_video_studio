import type { Playbook } from '../domain/Playbook'
import { validatePlaybook } from '../domain/Playbook'
import type {
  PlaybookRepository,
  PlaybookListFilter,
} from '../ports/PlaybookRepository'
import { getRedis } from '@/lib/redis'

/**
 * Repository Redis para Playbook.
 *
 * Layout:
 *   aaz:playbook:ws:{workspaceId}:{slug}                  → JSON do playbook corrente
 *   aaz:playbook:history:ws:{workspaceId}:{slug}          → List (LPUSH) de versões arquivadas
 *   aaz:playbook:index                                    → Set "ws::slug"
 *
 * Diferente de Character/StyleProfile, NÃO há escopo global —
 * playbooks são sempre workspace-scoped por design.
 */

const PREFIX = 'aaz:playbook:ws:'
const HISTORY_PREFIX = 'aaz:playbook:history:ws:'
const INDEX_KEY = 'aaz:playbook:index'

function key(slug: string, workspaceId: string): string {
  return `${PREFIX}${workspaceId}:${slug}`
}
function historyKey(slug: string, workspaceId: string): string {
  return `${HISTORY_PREFIX}${workspaceId}:${slug}`
}
function indexMember(slug: string, workspaceId: string): string {
  return `${workspaceId}::${slug}`
}
function parseIndex(member: string): { workspaceId: string; slug: string } {
  const [workspaceId, ...slugParts] = member.split('::')
  return { workspaceId, slug: slugParts.join('::') }
}

export class RedisPlaybookRepository implements PlaybookRepository {
  async findBySlug(
    slug: string,
    workspaceId: string,
  ): Promise<Playbook | null> {
    const redis = await getRedis()
    const raw = await redis.get(key(slug, workspaceId))
    if (!raw) return null
    try {
      return JSON.parse(raw) as Playbook
    } catch (err) {
      console.error('[RedisPlaybookRepository] corrupt JSON', {
        slug,
        workspaceId,
        err,
      })
      return null
    }
  }

  async list(filter?: PlaybookListFilter): Promise<Playbook[]> {
    const redis = await getRedis()
    const members = await redis.sMembers(INDEX_KEY)
    if (members.length === 0) return []

    const items: Playbook[] = []
    for (const member of members) {
      const { workspaceId, slug } = parseIndex(member)
      if (filter?.workspaceId && workspaceId !== filter.workspaceId) continue
      const p = await this.findBySlug(slug, workspaceId)
      if (!p) continue
      if (filter?.isOfficial !== undefined && p.isOfficial !== filter.isOfficial) {
        continue
      }
      if (filter?.createdBy && p.createdBy !== filter.createdBy) continue
      items.push(p)
    }
    items.sort((a, b) => {
      if (a.isOfficial && !b.isOfficial) return -1
      if (!a.isOfficial && b.isOfficial) return 1
      return b.createdAt.localeCompare(a.createdAt)
    })
    if (filter?.limit && filter.limit > 0) return items.slice(0, filter.limit)
    return items
  }

  async upsert(playbook: Playbook): Promise<Playbook> {
    const validated = validatePlaybook(playbook)
    const redis = await getRedis()
    const k = key(validated.slug, validated.workspaceId)

    // Arquiva versão anterior se a versão mudou
    const existingRaw = await redis.get(k)
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw) as Playbook
        if (existing.version !== validated.version) {
          await redis.lPush(
            historyKey(validated.slug, validated.workspaceId),
            existingRaw,
          )
        }
      } catch {
        // ignora corrompido
      }
    }

    await redis.set(k, JSON.stringify(validated))
    await redis.sAdd(INDEX_KEY, indexMember(validated.slug, validated.workspaceId))
    return validated
  }

  async remove(slug: string, workspaceId: string): Promise<void> {
    const redis = await getRedis()
    await redis.del(key(slug, workspaceId))
    await redis.sRem(INDEX_KEY, indexMember(slug, workspaceId))
    // histórico preservado intencionalmente
  }

  async listVersions(
    slug: string,
    workspaceId: string,
  ): Promise<Playbook[]> {
    const redis = await getRedis()
    const raws = await redis.lRange(historyKey(slug, workspaceId), 0, -1)
    const out: Playbook[] = []
    for (const r of raws) {
      try {
        out.push(JSON.parse(r) as Playbook)
      } catch {
        // ignora corrompido
      }
    }
    return out
  }
}
