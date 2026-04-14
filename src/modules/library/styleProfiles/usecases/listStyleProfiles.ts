import type { StyleProfile } from '../domain/StyleProfile'
import type { StyleProfileRepository } from '../ports/StyleProfileRepository'

/**
 * Use case: listar profiles. Para o seletor do studio, prefira
 * `listStyleProfilesVisibleTo(workspaceId)` — retorna globais + do workspace.
 */
export async function listStyleProfiles(
  deps: { repo: StyleProfileRepository },
  filter?: {
    workspaceId?: string | null
    isOfficial?: boolean
    tag?: string
  },
): Promise<StyleProfile[]> {
  return deps.repo.list(filter)
}

export async function listStyleProfilesVisibleTo(
  deps: { repo: StyleProfileRepository },
  workspaceId: string | null,
): Promise<StyleProfile[]> {
  return deps.repo.listVisibleTo(workspaceId)
}
