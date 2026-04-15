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
  RedisProjectRepository,
  LEGACY_WORKSPACE_ID as PROJECTS_LEGACY_WORKSPACE_ID,
} from './infra/RedisProjectRepository'

// Composer (M5-PR1)
export { selectProjectRepo } from './composer'

export {
  getProject,
  getProjectOrThrow,
  listProjects,
  ProjectNotFoundError,
} from './usecases/getProject'
