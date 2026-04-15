/**
 * Composer — escolhe `ProjectRepository` (Redis vs Postgres) baseado
 * em flag `USE_POSTGRES_PROJECTS`. Mesmo padrão dos outros módulos.
 */

import { isFeatureEnabled, type FeatureFlagContext } from '@/lib/featureFlags'
import type { ProjectRepository } from './ports/ProjectRepository'
import { RedisProjectRepository } from './infra/RedisProjectRepository'
import { PostgresProjectRepository } from './infra/PostgresProjectRepository'

export function selectProjectRepo(
  context: FeatureFlagContext = {},
): ProjectRepository {
  return isFeatureEnabled('USE_POSTGRES_PROJECTS', context)
    ? new PostgresProjectRepository()
    : new RedisProjectRepository()
}
