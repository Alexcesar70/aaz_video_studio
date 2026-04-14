import type { StyleProfile } from '../domain/StyleProfile'
import type { StyleProfileRepository } from '../ports/StyleProfileRepository'

/**
 * Use case: resolver profile com precedência workspace-override → global.
 */
export async function getStyleProfile(
  deps: { repo: StyleProfileRepository },
  params: { slug: string; workspaceId?: string | null },
): Promise<StyleProfile | null> {
  return deps.repo.findBySlug(params.slug, params.workspaceId ?? null)
}
