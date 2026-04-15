/**
 * Public API do módulo `playbooks`.
 *
 * Playbook = receita combinada (StyleProfile + Characters +
 * PromptTemplate overrides + defaults de geração) que um Team
 * Leader cria para padronizar o output do workspace.
 *
 * Sempre workspace-scoped — não há playbooks globais. Cada workspace
 * gerencia os seus.
 *
 * Wiring nas rotas e na UI fica gated pela flag `PROMPT_PLAYBOOKS`
 * (declarada desde M1, usada em PR futuro).
 */

// Domain
export type {
  Playbook,
  PlaybookDefaults,
  PlaybookEditablePatch,
} from './domain/Playbook'
export {
  validatePlaybook,
  bumpPlaybookVersion,
  forkPlaybook,
  InvalidPlaybookError,
} from './domain/Playbook'

// Ports
export type {
  PlaybookRepository,
  PlaybookListFilter,
} from './ports/PlaybookRepository'

// Infra
export { InMemoryPlaybookRepository } from './infra/InMemoryPlaybookRepository'
export { RedisPlaybookRepository } from './infra/RedisPlaybookRepository'

// Use cases
export {
  upsertPlaybook,
  getPlaybook,
  getPlaybookOrThrow,
  listPlaybooks,
  getPlaybookVersions,
  clonePlaybook,
  PlaybookNotFoundError,
} from './usecases/playbookOperations'
export type {
  UpsertPlaybookInput,
  UpsertPlaybookResult,
} from './usecases/playbookOperations'
