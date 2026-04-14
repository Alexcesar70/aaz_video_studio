import type { PromptTemplate } from '../domain/PromptTemplate'
import type { PromptTemplateRepository } from '../ports/PromptTemplateRepository'

/**
 * Use case: resolver um template por slug, com precedência workspace-override
 * → global. Retorna null se nenhum existir.
 *
 * Este é o ponto de entrada canônico que as rotas (PR #3+) vão usar,
 * protegido por feature flag USE_DB_PROMPTS.
 */
export async function getPromptTemplate(
  deps: { repo: PromptTemplateRepository },
  params: { slug: string; workspaceId?: string | null },
): Promise<PromptTemplate | null> {
  return deps.repo.findBySlug(params.slug, params.workspaceId ?? null)
}
