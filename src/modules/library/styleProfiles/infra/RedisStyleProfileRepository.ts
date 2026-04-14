import type { StyleProfile } from '../domain/StyleProfile'
import { validateStyleProfile } from '../domain/StyleProfile'
import type { StyleProfileRepository } from '../ports/StyleProfileRepository'
import { getRedis } from '@/lib/redis'

/**
 * RedisStyleProfileRepository
 *
 * Layout de chaves:
 *   aaz:style_profile:global:{slug}             → preset do sistema
 *   aaz:style_profile:ws:{workspaceId}:{slug}   → override do workspace
 *   aaz:style_profile:index                     → Set de "scope::slug"
 */

const GLOBAL_PREFIX = 'aaz:style_profile:global:'
const WS_PREFIX = 'aaz:style_profile:ws:'
const INDEX_KEY = 'aaz:style_profile:index'

function buildKey(slug: string, workspaceId: string | null): string {
  return workspaceId
    ? `${WS_PREFIX}${workspaceId}:${slug}`
    : `${GLOBAL_PREFIX}${slug}`
}

function indexMember(slug: string, workspaceId: string | null): string {
  return `${workspaceId ?? '__global__'}::${slug}`
}

function parseIndexMember(member: string): {
  workspaceId: string | null
  slug: string
} {
  const [scope, ...slugParts] = member.split('::')
  return {
    workspaceId: scope === '__global__' ? null : scope,
    slug: slugParts.join('::'),
  }
}

export class RedisStyleProfileRepository implements StyleProfileRepository {
  async findBySlug(
    slug: string,
    workspaceId?: string | null,
  ): Promise<StyleProfile | null> {
    if (workspaceId) {
      const override = await this.findBySlugExact(slug, workspaceId)
      if (override) return override
    }
    return this.findBySlugExact(slug, null)
  }

  async findBySlugExact(
    slug: string,
    workspaceId: string | null,
  ): Promise<StyleProfile | null> {
    const redis = await getRedis()
    const raw = await redis.get(buildKey(slug, workspaceId))
    if (!raw) return null
    try {
      return JSON.parse(raw) as StyleProfile
    } catch (err) {
      console.error('[RedisStyleProfileRepository] corrupt JSON', {
        slug,
        workspaceId,
        err,
      })
      return null
    }
  }

  async list(filter?: {
    workspaceId?: string | null
    isOfficial?: boolean
    tag?: string
  }): Promise<StyleProfile[]> {
    const redis = await getRedis()
    const members = await redis.sMembers(INDEX_KEY)
    if (members.length === 0) return []

    const results: StyleProfile[] = []
    for (const member of members) {
      const { workspaceId, slug } = parseIndexMember(member)
      if (
        filter?.workspaceId !== undefined &&
        workspaceId !== filter.workspaceId
      ) {
        continue
      }
      const p = await this.findBySlugExact(slug, workspaceId)
      if (!p) continue
      if (filter?.isOfficial !== undefined && p.isOfficial !== filter.isOfficial) {
        continue
      }
      if (filter?.tag && !(p.tags ?? []).includes(filter.tag)) continue
      results.push(p)
    }
    return results
  }

  async listVisibleTo(workspaceId: string | null): Promise<StyleProfile[]> {
    const all = await this.list()
    return all.filter(
      (p) => p.workspaceId === null || p.workspaceId === workspaceId,
    )
  }

  async upsert(profile: StyleProfile): Promise<StyleProfile> {
    const validated = validateStyleProfile(profile)
    const redis = await getRedis()
    const key = buildKey(validated.slug, validated.workspaceId)
    await redis.set(key, JSON.stringify(validated))
    await redis.sAdd(INDEX_KEY, indexMember(validated.slug, validated.workspaceId))
    return validated
  }

  async remove(slug: string, workspaceId: string | null): Promise<void> {
    const redis = await getRedis()
    await redis.del(buildKey(slug, workspaceId))
    await redis.sRem(INDEX_KEY, indexMember(slug, workspaceId))
  }
}
