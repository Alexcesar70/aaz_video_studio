/**
 * Public API do módulo `prompts`.
 *
 * Código fora deste módulo deve importar APENAS deste arquivo —
 * nunca de subpastas internas.
 *
 * Pattern:
 *   import { getPromptTemplate, RedisPromptTemplateRepository } from '@/modules/prompts'
 */

// Domain (tipos + validações puras)
export type {
  PromptTemplate,
  PromptTemplateKind,
} from './domain/PromptTemplate'
export {
  PROMPT_TEMPLATE_KINDS,
  validatePromptTemplate,
  bumpVersion,
  InvalidPromptTemplateError,
} from './domain/PromptTemplate'

// Ports (contratos — úteis para testes)
export type { PromptTemplateRepository } from './ports/PromptTemplateRepository'

// Infra (implementações concretas — ponto de composição)
export { RedisPromptTemplateRepository } from './infra/RedisPromptTemplateRepository'
export { InMemoryPromptTemplateRepository } from './infra/InMemoryPromptTemplateRepository'

// Use cases
export { getPromptTemplate } from './usecases/getPromptTemplate'
export { listPromptTemplates } from './usecases/listPromptTemplates'
export { upsertPromptTemplate } from './usecases/upsertPromptTemplate'
export { seedDefaultTemplates } from './usecases/seedDefaultTemplates'
export type { SeedResult } from './usecases/seedDefaultTemplates'

// Composers (aplicam composição mood/chain em cima do base do DB)
export { resolveSceneDirectorSystem } from './composers/sceneDirector'
export type { ResolvedSceneDirectorSystem } from './composers/sceneDirector'
export {
  resolveLyricsDirectorSystem,
  resolveStoryboardDirectorSystem,
  resolveSongPromptGeneratorSystem,
} from './composers/lyricsDirector'
export type { ResolvedLyricsSystem } from './composers/lyricsDirector'
