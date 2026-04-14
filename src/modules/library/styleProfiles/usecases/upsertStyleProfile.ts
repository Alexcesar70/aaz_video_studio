import type { StyleProfile } from '../domain/StyleProfile'
import {
  bumpStyleProfileVersion,
  validateStyleProfile,
} from '../domain/StyleProfile'
import type { StyleProfileRepository } from '../ports/StyleProfileRepository'

/**
 * Idempotente: rodar com mesmo conteúdo é no-op (retorna existente).
 * Se promptBlock, name, description, referenceUrls ou tags mudarem,
 * incrementa version.
 */
export async function upsertStyleProfile(
  deps: { repo: StyleProfileRepository },
  input: {
    slug: string
    name: string
    description?: string
    promptBlock: string
    referenceUrls?: string[]
    forkedFromId?: string
    workspaceId?: string | null
    tags?: string[]
    isOfficial?: boolean
    updatedBy?: string
  },
): Promise<{
  profile: StyleProfile
  action: 'created' | 'updated' | 'unchanged'
}> {
  const workspaceId = input.workspaceId ?? null
  const existing = await deps.repo.findBySlugExact(input.slug, workspaceId)

  if (!existing) {
    const fresh = validateStyleProfile({
      slug: input.slug,
      name: input.name,
      description: input.description,
      promptBlock: input.promptBlock,
      referenceUrls: input.referenceUrls,
      forkedFromId: input.forkedFromId,
      workspaceId,
      tags: input.tags,
      isOfficial: input.isOfficial ?? false,
      version: 1,
      createdBy: input.updatedBy,
      updatedBy: input.updatedBy,
    })
    const saved = await deps.repo.upsert(fresh)
    return { profile: saved, action: 'created' }
  }

  const changed =
    existing.name !== input.name.trim() ||
    (existing.description ?? '') !== (input.description?.trim() ?? '') ||
    existing.promptBlock !== input.promptBlock ||
    JSON.stringify(existing.referenceUrls ?? []) !==
      JSON.stringify(input.referenceUrls ?? []) ||
    JSON.stringify(existing.tags ?? []) !== JSON.stringify(input.tags ?? [])

  if (!changed) {
    return { profile: existing, action: 'unchanged' }
  }

  const bumped = bumpStyleProfileVersion(existing, {
    name: input.name,
    description: input.description,
    promptBlock: input.promptBlock,
    referenceUrls: input.referenceUrls,
    tags: input.tags,
    updatedBy: input.updatedBy,
  })
  const saved = await deps.repo.upsert(bumped)
  return { profile: saved, action: 'updated' }
}
