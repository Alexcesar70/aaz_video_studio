import type { Playbook } from '../domain/Playbook'

export interface PlaybookListFilter {
  workspaceId?: string
  isOfficial?: boolean
  createdBy?: string
  limit?: number
}

export interface PlaybookRepository {
  findBySlug(slug: string, workspaceId: string): Promise<Playbook | null>
  list(filter?: PlaybookListFilter): Promise<Playbook[]>

  /** Insere ou atualiza. Implementação arquiva versão anterior se version mudar. */
  upsert(playbook: Playbook): Promise<Playbook>

  /** Remove apenas o registro corrente; histórico de versões é preservado. */
  remove(slug: string, workspaceId: string): Promise<void>

  /** Histórico de versões em ordem desc (não inclui a corrente). */
  listVersions(slug: string, workspaceId: string): Promise<Playbook[]>
}
