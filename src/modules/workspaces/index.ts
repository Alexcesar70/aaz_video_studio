/**
 * Public API do módulo `workspaces`.
 *
 * M1 parcial: cobre apenas o fluxo de criação de workspace pelo
 * usuário final (signup wizard). Demais operações continuam em
 * `src/lib/organizations.ts` até o rename semântico do PR #8.
 */

export type {
  WorkspaceType,
  CreateWorkspaceInput,
} from './domain/workspaceInput'
export {
  validateCreateWorkspaceInput,
  InvalidWorkspaceInputError,
} from './domain/workspaceInput'

export {
  createWorkspaceForUser,
  UserNotFoundError,
  UserAlreadyHasWorkspaceError,
} from './usecases/createWorkspaceForUser'
export type {
  CreateWorkspaceDeps,
  CreateWorkspaceResult,
} from './usecases/createWorkspaceForUser'
