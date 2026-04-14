import type { StyleProfile } from '../domain/StyleProfile'
import type { StyleProfileRepository } from '../ports/StyleProfileRepository'
import { getStyleProfile } from './getStyleProfile'

/**
 * Retorna [versão corrente, ...versões anteriores] em ordem desc.
 * Retorna [] se o profile nem existe no escopo.
 *
 * Use case desenhado pro admin console exibir diff entre versões e
 * permitir rollback (futuro).
 */
export async function getStyleProfileVersions(
  deps: { repo: StyleProfileRepository },
  params: { slug: string; workspaceId?: string | null },
): Promise<StyleProfile[]> {
  const workspaceId = params.workspaceId ?? null
  const current = await getStyleProfile(deps, {
    slug: params.slug,
    workspaceId,
  })
  if (!current) return []

  // A corrente pode ter vindo do global por fallback. Usa o workspaceId
  // do registro real para buscar o histórico correto.
  const history = await deps.repo.listVersions(
    current.slug,
    current.workspaceId,
  )
  return [current, ...history]
}
