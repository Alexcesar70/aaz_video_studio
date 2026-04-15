import type { Project } from '../domain/Project'
import type {
  ProjectRepository,
  ProjectListFilter,
} from '../ports/ProjectRepository'

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`Project not found: ${id}`)
    this.name = 'ProjectNotFoundError'
  }
}

export async function getProject(
  deps: { repo: ProjectRepository },
  id: string,
): Promise<Project | null> {
  return deps.repo.findById(id)
}

export async function getProjectOrThrow(
  deps: { repo: ProjectRepository },
  id: string,
): Promise<Project> {
  const p = await deps.repo.findById(id)
  if (!p) throw new ProjectNotFoundError(id)
  return p
}

export async function listProjects(
  deps: { repo: ProjectRepository },
  filter?: ProjectListFilter,
): Promise<Project[]> {
  return deps.repo.list(filter)
}
