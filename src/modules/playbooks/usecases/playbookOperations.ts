import type { Playbook, PlaybookEditablePatch } from '../domain/Playbook'
import {
  bumpPlaybookVersion,
  forkPlaybook,
  validatePlaybook,
} from '../domain/Playbook'
import type {
  PlaybookRepository,
  PlaybookListFilter,
} from '../ports/PlaybookRepository'

export class PlaybookNotFoundError extends Error {
  constructor(slug: string, workspaceId: string) {
    super(`Playbook not found: ${workspaceId}/${slug}`)
    this.name = 'PlaybookNotFoundError'
  }
}

export interface UpsertPlaybookInput {
  slug: string
  workspaceId: string
  name: string
  description?: string
  styleProfileSlug?: string
  characterSlugs?: string[]
  promptOverrides?: Record<string, string>
  defaults?: {
    videoEngineId?: string
    imageEngineId?: string
    mood?: string
    durationSec?: number
  }
  forkedFromId?: string
  isOfficial?: boolean
  actorUserId?: string
}

export interface UpsertPlaybookResult {
  playbook: Playbook
  action: 'created' | 'unchanged' | 'updated'
}

/**
 * Idempotente. Cria se ausente, atualiza se conteúdo difere, no-op
 * se conteúdo bate byte-a-byte.
 */
export async function upsertPlaybook(
  deps: { repo: PlaybookRepository },
  input: UpsertPlaybookInput,
): Promise<UpsertPlaybookResult> {
  const existing = await deps.repo.findBySlug(input.slug, input.workspaceId)

  if (!existing) {
    const created = validatePlaybook({
      slug: input.slug,
      name: input.name,
      description: input.description,
      workspaceId: input.workspaceId,
      styleProfileSlug: input.styleProfileSlug,
      characterSlugs: input.characterSlugs ?? [],
      promptOverrides: input.promptOverrides,
      defaults: input.defaults,
      forkedFromId: input.forkedFromId,
      isOfficial: input.isOfficial ?? false,
      version: 1,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    })
    const saved = await deps.repo.upsert(created)
    return { playbook: saved, action: 'created' }
  }

  const patch: PlaybookEditablePatch = {
    name: input.name,
    description: input.description,
    styleProfileSlug: input.styleProfileSlug,
    characterSlugs: input.characterSlugs,
    promptOverrides: input.promptOverrides,
    defaults: input.defaults,
    updatedBy: input.actorUserId,
  }
  if (isSameContent(existing, patch)) {
    return { playbook: existing, action: 'unchanged' }
  }

  const bumped = bumpPlaybookVersion(existing, patch)
  const saved = await deps.repo.upsert(bumped)
  return { playbook: saved, action: 'updated' }
}

export async function getPlaybook(
  deps: { repo: PlaybookRepository },
  params: { slug: string; workspaceId: string },
): Promise<Playbook | null> {
  return deps.repo.findBySlug(params.slug, params.workspaceId)
}

export async function getPlaybookOrThrow(
  deps: { repo: PlaybookRepository },
  params: { slug: string; workspaceId: string },
): Promise<Playbook> {
  const p = await getPlaybook(deps, params)
  if (!p) throw new PlaybookNotFoundError(params.slug, params.workspaceId)
  return p
}

export async function listPlaybooks(
  deps: { repo: PlaybookRepository },
  filter?: PlaybookListFilter,
): Promise<Playbook[]> {
  return deps.repo.list(filter)
}

export async function getPlaybookVersions(
  deps: { repo: PlaybookRepository },
  params: { slug: string; workspaceId: string },
): Promise<Playbook[]> {
  const current = await deps.repo.findBySlug(params.slug, params.workspaceId)
  if (!current) return []
  const history = await deps.repo.listVersions(
    params.slug,
    params.workspaceId,
  )
  return [current, ...history]
}

/**
 * Cria fork (cópia editável) — caller decide o slug novo.
 * Lança PlaybookNotFoundError se o source não existe.
 */
export async function clonePlaybook(
  deps: { repo: PlaybookRepository },
  input: {
    sourceSlug: string
    sourceWorkspaceId: string
    targetSlug: string
    targetWorkspaceId: string
    targetName?: string
    actorUserId?: string
  },
): Promise<Playbook> {
  const source = await deps.repo.findBySlug(
    input.sourceSlug,
    input.sourceWorkspaceId,
  )
  if (!source) {
    throw new PlaybookNotFoundError(input.sourceSlug, input.sourceWorkspaceId)
  }
  const fork = forkPlaybook(source, {
    slug: input.targetSlug,
    workspaceId: input.targetWorkspaceId,
    createdBy: input.actorUserId,
    name: input.targetName,
  })
  return deps.repo.upsert(fork)
}

function isSameContent(
  current: Playbook,
  patch: PlaybookEditablePatch,
): boolean {
  return (
    current.name === patch.name?.trim() &&
    (current.description ?? undefined) === patch.description?.trim() &&
    current.styleProfileSlug === patch.styleProfileSlug &&
    arraysEqual(current.characterSlugs, patch.characterSlugs ?? []) &&
    JSON.stringify(current.promptOverrides ?? null) ===
      JSON.stringify(patch.promptOverrides ?? null) &&
    JSON.stringify(current.defaults ?? null) ===
      JSON.stringify(patch.defaults ?? null)
  )
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}
