/**
 * Public API do módulo `library`.
 *
 * Em M1 este módulo abriga:
 *   - Seed dos Lead Characters do AAZ (PR #4).
 *   - StyleProfile como entidade de primeira classe (PR #5).
 *
 * O escopo completo (Character como entidade, ReferenceAsset, LibraryBundle,
 * versionamento, forking) é construído nos PRs seguintes e no M2.
 */

// ── Lead Characters (AAZ-specific seed data) ──
export {
  AAZ_LEAD_CHARACTERS,
  AAZ_DEFAULT_ORG_ID,
} from './seeds/aazLeadCharacters'

export {
  seedAazLeadCharacters,
  type SeedLeadsResult,
  type SeedRedisLike,
} from './usecases/seedAazLeadCharacters'

// ── Style Profiles (entidade de primeira classe) ──
export type { StyleProfile } from './styleProfiles/domain/StyleProfile'
export {
  validateStyleProfile,
  bumpStyleProfileVersion,
  InvalidStyleProfileError,
} from './styleProfiles/domain/StyleProfile'

export type { StyleProfileRepository } from './styleProfiles/ports/StyleProfileRepository'

export { RedisStyleProfileRepository } from './styleProfiles/infra/RedisStyleProfileRepository'
export { InMemoryStyleProfileRepository } from './styleProfiles/infra/InMemoryStyleProfileRepository'

export { getStyleProfile } from './styleProfiles/usecases/getStyleProfile'
export {
  listStyleProfiles,
  listStyleProfilesVisibleTo,
} from './styleProfiles/usecases/listStyleProfiles'
export { upsertStyleProfile } from './styleProfiles/usecases/upsertStyleProfile'
export {
  seedDefaultStyleProfiles,
  type StyleProfileSeedResult,
} from './styleProfiles/usecases/seedDefaultStyleProfiles'
