/**
 * Public API do módulo `library`.
 *
 * Em M1 este módulo é parcial: contém apenas o seed dos Lead Characters
 * do AAZ. O escopo completo (Character entity, StyleProfile, ReferenceAsset,
 * LibraryBundle, versionamento) é construído progressivamente nos PRs
 * seguintes (#5+) e no Milestone 2.
 */

export {
  AAZ_LEAD_CHARACTERS,
  AAZ_DEFAULT_ORG_ID,
} from './seeds/aazLeadCharacters'

export {
  seedAazLeadCharacters,
  type SeedLeadsResult,
  type SeedRedisLike,
} from './usecases/seedAazLeadCharacters'
