import type { Character } from '../domain/Character'
import type {
  CharacterRepository,
  CharacterListFilter,
} from '../ports/CharacterRepository'

/**
 * Lista characters com filtros.
 */
export async function listCharacters(
  deps: { repo: CharacterRepository },
  filter?: CharacterListFilter,
): Promise<Character[]> {
  return deps.repo.list(filter)
}

/**
 * Lista characters visíveis para um workspace: globais + do próprio
 * workspace. Útil para o picker do Studio/Atelier.
 *
 * Se o workspace tem override (mesmo slug) de um global, o override
 * vence e o global é suprimido na listagem final.
 */
export async function listCharactersVisibleTo(
  deps: { repo: CharacterRepository },
  params: { workspaceId: string | null },
): Promise<Character[]> {
  if (params.workspaceId === null) {
    return deps.repo.list({ workspaceId: null })
  }

  const [globals, workspace] = await Promise.all([
    deps.repo.list({ workspaceId: null }),
    deps.repo.list({ workspaceId: params.workspaceId }),
  ])

  const workspaceSlugs = new Set(workspace.map((c) => c.slug))
  const filteredGlobals = globals.filter((g) => !workspaceSlugs.has(g.slug))

  const merged = [...workspace, ...filteredGlobals]
  merged.sort((a, b) => {
    if (a.isOfficial && !b.isOfficial) return -1
    if (!a.isOfficial && b.isOfficial) return 1
    return b.createdAt.localeCompare(a.createdAt)
  })
  return merged
}
