import type { Character, CharacterEditablePatch } from '../domain/Character'
import {
  bumpCharacterVersion,
  validateCharacter,
} from '../domain/Character'
import type { CharacterRepository } from '../ports/CharacterRepository'

export class CharacterConflictError extends Error {
  constructor(slug: string) {
    super(`Character conflict: ${slug} — não pode sobrescrever official global`)
    this.name = 'CharacterConflictError'
  }
}

export interface UpsertCharacterInput {
  slug: string
  workspaceId: string | null
  name: string
  description?: string
  promptBlock?: string
  imageUrls: string[]
  emoji?: string
  tags?: string[]
  forkedFromId?: string
  /** Se true e ainda não existir, cria como preset oficial. */
  isOfficial?: boolean
  /** User que está criando / editando. */
  actorUserId?: string
}

export interface UpsertCharacterResult {
  character: Character
  /**
   * - 'created': era a primeira inserção (ou só existia em outro escopo).
   * - 'unchanged': o conteúdo já bateu byte-a-byte com a versão corrente.
   * - 'updated': havia uma versão anterior no mesmo escopo, versão foi bumpada.
   */
  action: 'created' | 'unchanged' | 'updated'
}

/**
 * Insere ou atualiza um Character. Idempotente em relação ao conteúdo:
 * chamar 2x com mesmo `imageUrls`/`name`/`promptBlock` é no-op
 * (action: 'unchanged').
 *
 * Regras:
 *   - Não permite sobrescrever um character GLOBAL `isOfficial=true` via
 *     workspaceId≠null — forks devem usar slug diferente.
 *   - Ao editar (action='updated'), `version` é incrementado e a versão
 *     anterior é arquivada pelo repo no histórico.
 */
export async function upsertCharacter(
  deps: { repo: CharacterRepository },
  input: UpsertCharacterInput,
): Promise<UpsertCharacterResult> {
  // Proteção: não permite criar duplicata no mesmo escopo de um
  // character global isOfficial, a menos que o escopo seja igual (admin
  // editando o próprio preset). Se o chamador quer customizar, deve
  // criar no escopo do workspace com outro slug (via forkCharacter).
  if (input.workspaceId !== null) {
    const globalExists = await deps.repo.findBySlugExact(input.slug, null)
    if (globalExists?.isOfficial) {
      throw new CharacterConflictError(input.slug)
    }
  }

  const existing = await deps.repo.findBySlugExact(
    input.slug,
    input.workspaceId,
  )

  if (!existing) {
    const created = validateCharacter({
      slug: input.slug,
      name: input.name,
      description: input.description,
      promptBlock: input.promptBlock,
      imageUrls: input.imageUrls,
      emoji: input.emoji,
      tags: input.tags,
      forkedFromId: input.forkedFromId,
      workspaceId: input.workspaceId,
      isOfficial: input.isOfficial ?? false,
      version: 1,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    })
    const saved = await deps.repo.upsert(created)
    return { character: saved, action: 'created' }
  }

  // Normaliza o patch e compara com o existente para dedupe.
  const patch: CharacterEditablePatch = {
    name: input.name,
    description: input.description,
    promptBlock: input.promptBlock,
    imageUrls: input.imageUrls,
    emoji: input.emoji,
    tags: input.tags,
    updatedBy: input.actorUserId,
  }
  if (isSameContent(existing, patch)) {
    return { character: existing, action: 'unchanged' }
  }

  const bumped = bumpCharacterVersion(existing, patch)
  const saved = await deps.repo.upsert(bumped)
  return { character: saved, action: 'updated' }
}

function isSameContent(current: Character, patch: CharacterEditablePatch): boolean {
  return (
    current.name === patch.name?.trim() &&
    (current.description ?? undefined) === patch.description?.trim() &&
    current.promptBlock === patch.promptBlock &&
    arraysEqual(current.imageUrls, patch.imageUrls ?? []) &&
    current.emoji === patch.emoji &&
    arraysEqual(current.tags ?? [], patch.tags ?? [])
  )
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}
