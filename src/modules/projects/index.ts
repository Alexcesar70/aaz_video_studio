/**
 * Public API do módulo `projects`.
 *
 * Novo no M3. Substitui progressivamente as chaves `aaz:project:*` do
 * Redis (hoje acessadas via rotas /api/projects/*) por Postgres.
 */

export type { Project } from './domain/Project'
export { validateProject, InvalidProjectError } from './domain/Project'

export type {
  ProjectRepository,
  ProjectListFilter,
} from './ports/ProjectRepository'

export { InMemoryProjectRepository } from './infra/InMemoryProjectRepository'
export {
  PostgresProjectRepository,
  rowToProject,
  projectToInsert,
} from './infra/PostgresProjectRepository'

export {
  getProject,
  getProjectOrThrow,
  listProjects,
  ProjectNotFoundError,
} from './usecases/getProject'
