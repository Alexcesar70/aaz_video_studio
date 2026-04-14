import type { PromptTemplate, PromptTemplateKind } from '../domain/PromptTemplate'
import type { PromptTemplateRepository } from '../ports/PromptTemplateRepository'

/**
 * Use case: listar templates. Suporta filtro por kind e por escopo
 * (global vs workspace específico).
 *
 * Consumido pelo admin console para exibir templates existentes e
 * permitir edição/override.
 */
export async function listPromptTemplates(
  deps: { repo: PromptTemplateRepository },
  filter?: {
    kind?: PromptTemplateKind
    workspaceId?: string | null
  },
): Promise<PromptTemplate[]> {
  return deps.repo.list(filter)
}
