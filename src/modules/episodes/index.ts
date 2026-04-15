/**
 * Public API do módulo `episodes`.
 */

export type {
  Episode,
  EpisodeFinalStatus,
} from './domain/Episode'
export {
  validateEpisode,
  EPISODE_FINAL_STATUSES,
  InvalidEpisodeError,
} from './domain/Episode'

export type {
  EpisodeRepository,
  EpisodeListFilter,
} from './ports/EpisodeRepository'

export { InMemoryEpisodeRepository } from './infra/InMemoryEpisodeRepository'
export {
  PostgresEpisodeRepository,
  rowToEpisode,
  episodeToInsert,
} from './infra/PostgresEpisodeRepository'
export {
  RedisEpisodeRepository,
  LEGACY_WORKSPACE_ID as EPISODES_LEGACY_WORKSPACE_ID,
} from './infra/RedisEpisodeRepository'

// Composer (M5-PR1)
export { selectEpisodeRepo } from './composer'

export {
  getEpisode,
  getEpisodeOrThrow,
  listEpisodes,
  EpisodeNotFoundError,
} from './usecases/getEpisode'
