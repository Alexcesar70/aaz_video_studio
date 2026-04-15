import type { Character } from '../domain/Character'
import type { CharacterRepository } from '../ports/CharacterRepository'
import { getCharacter } from './getCharacter'

/**
 * Retorna a versão corrente + versões arquivadas em histórico.
 * Ordem: corrente primeiro, depois histórico (desc).
 *
 * Retorna [] se o character nem existe no escopo.
 */
export async function getCharacterVersions(
  deps: { repo: CharacterRepository },
  params: { slug: string; workspaceId?: string | null },
): Promise<Character[]> {
  const workspaceId = params.workspaceId ?? null
  const current = await getCharacter(deps, { slug: params.slug, workspaceId })
  if (!current) return []

  // A versão "corrente" pode ter vindo do global (fallback). O histórico
  // está atrelado ao escopo REAL do registro — usa current.workspaceId.
  const history = await deps.repo.listVersions(
    current.slug,
    current.workspaceId,
  )
  return [current, ...history]
}
