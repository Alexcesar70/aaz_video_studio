/**
 * Composer — escolhe `EpisodeRepository` (Redis vs Postgres) baseado
 * em flag `USE_POSTGRES_EPISODES`. Mesmo padrão dos outros módulos.
 */

import { isFeatureEnabled, type FeatureFlagContext } from '@/lib/featureFlags'
import type { EpisodeRepository } from './ports/EpisodeRepository'
import { RedisEpisodeRepository } from './infra/RedisEpisodeRepository'
import { PostgresEpisodeRepository } from './infra/PostgresEpisodeRepository'

export function selectEpisodeRepo(
  context: FeatureFlagContext = {},
): EpisodeRepository {
  return isFeatureEnabled('USE_POSTGRES_EPISODES', context)
    ? new PostgresEpisodeRepository()
    : new RedisEpisodeRepository()
}
