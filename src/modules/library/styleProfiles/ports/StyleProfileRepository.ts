import type { StyleProfile } from '../domain/StyleProfile'

/**
 * Contrato de persistência para StyleProfile.
 *
 * Resolução workspace → global (igual ao PromptTemplateRepository):
 * `findBySlug(slug, workspaceId)` tenta override do workspace e faz
 * fallback pro global se ausente.
 */
export interface StyleProfileRepository {
  findBySlug(
    slug: string,
    workspaceId?: string | null,
  ): Promise<StyleProfile | null>

  findBySlugExact(
    slug: string,
    workspaceId: string | null,
  ): Promise<StyleProfile | null>

  list(filter?: {
    workspaceId?: string | null
    isOfficial?: boolean
    tag?: string
  }): Promise<StyleProfile[]>

  /**
   * Lista profiles visíveis a um workspace: globais + overrides do próprio.
   * Útil para UI de seletor no studio.
   */
  listVisibleTo(workspaceId: string | null): Promise<StyleProfile[]>

  upsert(profile: StyleProfile): Promise<StyleProfile>

  remove(slug: string, workspaceId: string | null): Promise<void>
}
