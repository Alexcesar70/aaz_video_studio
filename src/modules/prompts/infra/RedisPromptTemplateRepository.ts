import type { PromptTemplate, PromptTemplateKind } from '../domain/PromptTemplate'
import { validatePromptTemplate } from '../domain/PromptTemplate'
import type { PromptTemplateRepository } from '../ports/PromptTemplateRepository'
import { getRedis } from '@/lib/redis'

/**
 * Repository Redis para PromptTemplate.
 *
 * Layout de chaves:
 *   aaz:prompt_template:global:{slug}              → template global
 *   aaz:prompt_template:ws:{workspaceId}:{slug}    → override do workspace
 *   aaz:prompt_template:index                      → Set de "scope::slug" para listagem
 *
 * Escolha consciente: não usamos SCAN por performance. O index é um Set
 * que mantém a lista de todas as chaves existentes.
 */
const GLOBAL_PREFIX = 'aaz:prompt_template:global:'
const WS_PREFIX = 'aaz:prompt_template:ws:'
const INDEX_KEY = 'aaz:prompt_template:index'

function buildKey(slug: string, workspaceId: string | null): string {
  return workspaceId
    ? `${WS_PREFIX}${workspaceId}:${slug}`
    : `${GLOBAL_PREFIX}${slug}`
}

function indexMember(slug: string, workspaceId: string | null): string {
  return `${workspaceId ?? '__global__'}::${slug}`
}

function parseIndexMember(member: string): { workspaceId: string | null; slug: string } {
  const [scope, ...slugParts] = member.split('::')
  const slug = slugParts.join('::')
  return {
    workspaceId: scope === '__global__' ? null : scope,
    slug,
  }
}

export class RedisPromptTemplateRepository implements PromptTemplateRepository {
  async findBySlug(
    slug: string,
    workspaceId?: string | null,
  ): Promise<PromptTemplate | null> {
    if (workspaceId) {
      const override = await this.findBySlugExact(slug, workspaceId)
      if (override) return override
    }
    return this.findBySlugExact(slug, null)
  }

  async findBySlugExact(
    slug: string,
    workspaceId: string | null,
  ): Promise<PromptTemplate | null> {
    const redis = await getRedis()
    const raw = await redis.get(buildKey(slug, workspaceId))
    if (!raw) return null
    try {
      return JSON.parse(raw) as PromptTemplate
    } catch (err) {
      console.error('[RedisPromptTemplateRepository] corrupt JSON', {
        slug,
        workspaceId,
        err,
      })
      return null
    }
  }

  async list(filter?: {
    kind?: PromptTemplateKind
    workspaceId?: string | null
  }): Promise<PromptTemplate[]> {
    const redis = await getRedis()
    const members = await redis.sMembers(INDEX_KEY)
    if (members.length === 0) return []

    const results: PromptTemplate[] = []
    for (const member of members) {
      const { workspaceId, slug } = parseIndexMember(member)
      if (filter?.workspaceId !== undefined && workspaceId !== filter.workspaceId) {
        continue
      }
      const tpl = await this.findBySlugExact(slug, workspaceId)
      if (!tpl) continue
      if (filter?.kind && tpl.kind !== filter.kind) continue
      results.push(tpl)
    }
    return results
  }

  async upsert(template: PromptTemplate): Promise<PromptTemplate> {
    const validated = validatePromptTemplate(template)
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
