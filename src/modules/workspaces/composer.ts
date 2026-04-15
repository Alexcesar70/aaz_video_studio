/**
 * Composer — escolhe `WorkspaceRepository` (Redis vs Postgres)
 * baseado em flag `USE_POSTGRES_WORKSPACES`.
 */

import { isFeatureEnabled, type FeatureFlagContext } from '@/lib/featureFlags'
import type { WorkspaceRepository } from './ports/WorkspaceRepository'
import { RedisWorkspaceRepository } from './infra/RedisWorkspaceRepository'
import { PostgresWorkspaceRepository } from './infra/PostgresWorkspaceRepository'

export function selectWorkspaceRepo(
  context: FeatureFlagContext = {},
): WorkspaceRepository {
  return isFeatureEnabled('USE_POSTGRES_WORKSPACES', context)
    ? new PostgresWorkspaceRepository()
    : new RedisWorkspaceRepository()
}
