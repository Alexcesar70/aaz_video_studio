/**
 * Public API do módulo `workspaces`.
 *
 * Estado atual (PR #8):
 *   - Entidade `Workspace` disponível como alias tipado de `Organization`.
 *   - Funções CRUD re-exportadas com nomes novos.
 *   - Persistência continua em `src/lib/organizations.ts` até PR #9.
 *
 * Código novo DEVE importar daqui:
 *   import type { Workspace } from '@/modules/workspaces'
 *   import { createWorkspace, getWorkspaceById } from '@/modules/workspaces'
 *
 * Código legado em `src/lib/*` continua válido (retrocompat). Ver ADR-0004.
 */

// ── Domínio ──
export type {
  Workspace,
  WorkspaceStatus,
} from './domain/Workspace'

export type {
  WorkspaceType,
  CreateWorkspaceInput,
} from './domain/workspaceInput'
export {
  validateCreateWorkspaceInput,
  InvalidWorkspaceInputError,
} from './domain/workspaceInput'

// ── CRUD (re-export com nomenclatura nova) ──
// Shape e persistência idênticos ao legado; apenas nomes evoluíram.
export {
  createOrganization as createWorkspace,
  getOrgById as getWorkspaceById,
  getOrgBySlug as getWorkspaceBySlug,
  listOrganizations as listWorkspaces,
  updateOrganization as updateWorkspace,
  suspendOrganization as suspendWorkspace,
  reactivateOrganization as reactivateWorkspace,
  bootstrapDefaultOrg as bootstrapDefaultWorkspace,
  DEFAULT_ORG_ID as DEFAULT_WORKSPACE_ID,
} from '@/lib/organizations'

// ── Use cases ──
export {
  createWorkspaceForUser,
  UserNotFoundError,
  UserAlreadyHasWorkspaceError,
} from './usecases/createWorkspaceForUser'
export type {
  CreateWorkspaceDeps,
  CreateWorkspaceResult,
} from './usecases/createWorkspaceForUser'
