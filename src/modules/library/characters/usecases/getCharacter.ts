import type { Character } from '../domain/Character'
import type { CharacterRepository } from '../ports/CharacterRepository'

export class CharacterNotFoundError extends Error {
  constructor(slug: string) {
    super(`Character not found: ${slug}`)
    this.name = 'CharacterNotFoundError'
  }
}

/**
 * Busca um Character por slug, com precedência workspace-override → global.
 * Retorna null se nenhum existir (não lança).
 */
export async function getCharacter(
  deps: { repo: CharacterRepository },
  params: { slug: string; workspaceId?: string | null },
): Promise<Character | null> {
  return deps.repo.findBySlug(params.slug, params.workspaceId ?? null)
}

/**
 * Versão strict: lança `CharacterNotFoundError` em vez de retornar null.
 */
export async function getCharacterOrThrow(
  deps: { repo: CharacterRepository },
  params: { slug: string; workspaceId?: string | null },
): Promise<Character> {
  const c = await getCharacter(deps, params)
  if (!c) throw new CharacterNotFoundError(params.slug)
  return c
}
