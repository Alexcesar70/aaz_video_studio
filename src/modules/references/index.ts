/**
 * Public API do módulo `references`.
 *
 * ReferenceAsset é a entidade que representa uma mídia (imagem, vídeo,
 * áudio) usada como ENTRADA em uma geração. Se o uso é "ser referência",
 * o recurso vira um ReferenceAsset. Se o uso é "compor biblioteca
 * reutilizável de personagens/cenários/itens", permanece em `@/modules/library`.
 *
 * Pattern:
 *   import { createReferenceAsset, RedisReferenceAssetRepository } from '@/modules/references'
 *
 * Escopo do M2-PR3: foundation — CRUD + rotas REST. Zero wiring
 * em rotas existentes (/api/generate, /api/generate-image, etc.).
 * O wiring virá em M2-PR4 (Asset Picker unificado).
 */

// Domain
export type {
  ReferenceAsset,
  ReferenceMediaType,
  ReferenceSource,
  ReferenceSourceRef,
} from './domain/ReferenceAsset'
export {
  REFERENCE_MEDIA_TYPES,
  REFERENCE_SOURCES,
  validateReferenceAsset,
  inferMediaType,
  InvalidReferenceAssetError,
} from './domain/ReferenceAsset'

// Ports
export type {
  ReferenceAssetRepository,
  ReferenceAssetListFilter,
} from './ports/ReferenceAssetRepository'

// Infra
export { RedisReferenceAssetRepository } from './infra/RedisReferenceAssetRepository'
export { InMemoryReferenceAssetRepository } from './infra/InMemoryReferenceAssetRepository'

// Use cases
export { createReferenceAsset } from './usecases/createReferenceAsset'
export type { CreateReferenceAssetInput } from './usecases/createReferenceAsset'
export {
  getReferenceAsset,
  ReferenceAssetNotFoundError,
  ReferenceAssetAccessDeniedError,
} from './usecases/getReferenceAsset'
export type { GetReferenceAssetInput } from './usecases/getReferenceAsset'
export { listReferenceAssets } from './usecases/listReferenceAssets'
export { removeReferenceAsset } from './usecases/removeReferenceAsset'
export type {
  RemoveReferenceAssetInput,
  BlobDeleter,
} from './usecases/removeReferenceAsset'
