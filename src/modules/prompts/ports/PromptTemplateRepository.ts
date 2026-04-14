import type {
  PromptTemplate,
  PromptTemplateKind,
} from '../domain/PromptTemplate'

/**
 * Contrato de persistência de PromptTemplate.
 *
 * Implementações:
 *   - infra/RedisPromptTemplateRepository (produção)
 *   - infra/InMemoryPromptTemplateRepository (testes + dev offline)
 *
 * Regra de resolução importante: `findBySlug(slug, workspaceId)` deve
 * primeiro tentar o override do workspace e, se ausente, fazer fallback
 * para o template global (workspaceId=null). Isso permite um workspace
 * customizar um director sem afetar os outros.
 */
export interface PromptTemplateRepository {
  /**
   * Retorna o template com precedência workspace-override → global.
   * Retorna null se nenhum existir.
   */
  findBySlug(
    slug: string,
    workspaceId?: string | null,
  ): Promise<PromptTemplate | null>

  /**
   * Retorna apenas o template do escopo exato informado.
   * Útil para admin console que quer ver override vs global separadamente.
   */
  findBySlugExact(
    slug: string,
    workspaceId: string | null,
  ): Promise<PromptTemplate | null>

  /**
   * Lista templates. Sem filtro = todos visíveis ao caller.
   */
  list(filter?: {
    kind?: PromptTemplateKind
    workspaceId?: string | null // null = global, undefined = não filtra
  }): Promise<PromptTemplate[]>

  /**
   * Insere ou atualiza. Se já existir (mesmo slug + workspaceId), faz upsert.
   * A implementação é responsável por incrementar version se o content mudar.
   */
  upsert(template: PromptTemplate): Promise<PromptTemplate>

  /**
   * Remove template do escopo exato. No-op se não existir.
   */
  remove(slug: string, workspaceId: string | null): Promise<void>
}
