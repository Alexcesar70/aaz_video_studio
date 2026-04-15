import type { Workspace, WorkspaceStatus } from '../domain/Workspace'

/**
 * Contrato de persistência de Workspace (shape = Organization — ver
 * ADR-0004, alias type).
 *
 * Implementações:
 *   - infra/PostgresWorkspaceRepository (M3+ produção)
 *   - infra/InMemoryWorkspaceRepository (testes)
 *   - O adapter Redis legado ainda vive em `src/lib/organizations.ts` —
 *     será envelopado num `RedisWorkspaceRepository` no PR de wiring.
 *
 * Regra: `findBySlug` é útil no signup/URL-based lookup. `findById`
 * em tudo que já carrega o id na sessão.
 */
export interface WorkspaceListFilter {
  status?: WorkspaceStatus
  ownerId?: string
  limit?: number
}

export interface WorkspaceRepository {
  findById(id: string): Promise<Workspace | null>
  findBySlug(slug: string): Promise<Workspace | null>
  list(filter?: WorkspaceListFilter): Promise<Workspace[]>
  upsert(workspace: Workspace): Promise<Workspace>
  remove(id: string): Promise<void>
}
