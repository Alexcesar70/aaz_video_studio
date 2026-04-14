/**
 * Workspace — tipos aliases sobre o modelo legado `Organization`.
 *
 * Este arquivo existe para permitir que código NOVO (src/modules/*)
 * use a nomenclatura `Workspace` sem precisar tocar em todos os call
 * sites legados de `Organization` de uma vez (seriam centenas).
 *
 * Estratégia (ADR-0004):
 *   - Aliases TYPE-ONLY (zero custo de runtime).
 *   - `Organization` permanece válido (retrocompat).
 *   - Código novo importa de `@/modules/workspaces`.
 *   - Código legado continua importando de `@/lib/organizations`.
 *   - Ambos apontam para a MESMA entidade, no MESMO shape, nas MESMAS
 *     chaves do Redis (aaz:org:*).
 *
 * Quando PR #9 consolidar, o lib/organizations vira re-export dos
 * módulos, ou é removido se todos os consumers já tiverem migrado.
 */

import type {
  Organization,
  OrgStatus,
  OrgType,
} from '@/lib/organizations'

/** O Workspace é a unidade de tenancy do Creative Studio. */
export type Workspace = Organization

export type WorkspaceStatus = OrgStatus

/**
 * WorkspaceType também é exportado de `./workspaceInput` — ambos são
 * o mesmo tipo. Este re-export mantém simetria com Workspace/WorkspaceStatus.
 */
export type WorkspaceTypeAlias = OrgType
