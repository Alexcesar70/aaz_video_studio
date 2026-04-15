import type { Project } from '../domain/Project'

export interface ProjectListFilter {
  workspaceId?: string
  createdBy?: string
  /** Filtra projetos onde o userId está em `memberIds`. */
  memberId?: string
  limit?: number
}

export interface ProjectRepository {
  findById(id: string): Promise<Project | null>
  list(filter?: ProjectListFilter): Promise<Project[]>
  upsert(project: Project): Promise<Project>
  remove(id: string): Promise<void>
}
