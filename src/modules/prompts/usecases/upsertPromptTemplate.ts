import type { PromptTemplate, PromptTemplateKind } from '../domain/PromptTemplate'
import { bumpVersion, validatePromptTemplate } from '../domain/PromptTemplate'
import type { PromptTemplateRepository } from '../ports/PromptTemplateRepository'

/**
 * Use case: criar ou atualizar um template.
 *
 * Comportamento:
 *   - Se não existe: cria com version=1.
 *   - Se existe e content mudou: incrementa version via bumpVersion.
 *   - Se existe e content é idêntico: no-op silencioso (retorna o existente).
 *
 * Esse comportamento torna o seed idempotente: rodar 2x não "suja" o histórico.
 */
export async function upsertPromptTemplate(
  deps: { repo: PromptTemplateRepository },
  input: {
    slug: string
    kind: PromptTemplateKind
    content: string
    description?: string
    workspaceId?: string | null
    updatedBy?: string
  },
): Promise<{ template: PromptTemplate; action: 'created' | 'updated' | 'unchanged' }> {
  const workspaceId = input.workspaceId ?? null
  const existing = await deps.repo.findBySlugExact(input.slug, workspaceId)

  if (!existing) {
    const fresh = validatePromptTemplate({
      slug: input.slug,
      kind: input.kind,
      content: input.content,
      description: input.description,
      version: 1,
      workspaceId,
      createdBy: input.updatedBy,
      updatedBy: input.updatedBy,
    })
    const saved = await deps.repo.upsert(fresh)
    return { template: saved, action: 'created' }
  }

  const contentChanged = existing.content !== input.content
  const descriptionChanged = (existing.description ?? '') !== (input.description ?? '')

  if (!contentChanged && !descriptionChanged) {
    return { template: existing, action: 'unchanged' }
  }

  const bumped = bumpVersion(existing, {
    content: input.content,
    description: input.description,
    updatedBy: input.updatedBy,
  })
  const saved = await deps.repo.upsert(bumped)
  return { template: saved, action: 'updated' }
}
