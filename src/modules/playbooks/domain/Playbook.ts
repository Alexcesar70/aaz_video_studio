/**
 * Playbook — receita combinada que un Team Leader cria pra padronizar
 * a saída do workspace. Substitui o trabalho de "lembrar todas as
 * configurações certas em cada cena".
 *
 * Composição:
 *   - StyleProfile (visual base — clay, anime, cinematic, ...)
 *   - Character set (personagens default disponíveis no Studio)
 *   - PromptTemplate overrides (Scene Director custom, Lyrics
 *     Director custom — cada workspace pode ter sua "voz")
 *   - Defaults de geração (engine, mood, duration preferidos)
 *
 * Sempre **workspace-scoped** — não há playbooks globais. Cada
 * workspace gerencia os seus.
 *
 * Versionamento: igual ao Character/StyleProfile — toda edição
 * bumpa `version`, repositório arquiva versões anteriores em
 * histórico.
 *
 * Este módulo é PURO — sem I/O, sem imports de infra.
 */

export interface PlaybookDefaults {
  videoEngineId?: string
  imageEngineId?: string
  /** mood id, ver @/lib/moods */
  mood?: string
  /** duração padrão de cena em segundos */
  durationSec?: number
}

export interface Playbook {
  /** Slug único dentro do workspace. */
  slug: string
  /** Nome humano para a UI ("AAZ Clássico", "Visão Documental", ...). */
  name: string
  description?: string
  /** Workspace dono — playbooks NÃO são globais. */
  workspaceId: string

  /** Slug do StyleProfile que este playbook usa (vê @/modules/library). */
  styleProfileSlug?: string

  /** Slugs de characters padrão visíveis ao Studio quando este playbook está ativo. */
  characterSlugs: string[]

  /**
   * Overrides de PromptTemplate por slug. Ex.:
   *   { 'scene_director_base': '<conteúdo customizado>' }
   * Quando ausente, fallback é pro template global.
   */
  promptOverrides?: Record<string, string>

  /** Defaults aplicados na UI quando o playbook está selecionado. */
  defaults?: PlaybookDefaults

  /** Lineage: slug do playbook fonte de um fork. */
  forkedFromId?: string

  /**
   * true = preset oficial do workspace (Owner ou Team Leader criou).
   * false = playbook pessoal de creator.
   */
  isOfficial: boolean

  /** Versão monotônica — bumpa a cada edit. */
  version: number

  createdBy?: string
  updatedBy?: string
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

export class InvalidPlaybookError extends Error {
  constructor(message: string) {
    super(`Invalid Playbook: ${message}`)
    this.name = 'InvalidPlaybookError'
  }
}

const SLUG_REGEX = /^[a-z0-9_-]+$/

export function validatePlaybook(input: Partial<Playbook>): Playbook {
  if (!input.slug || typeof input.slug !== 'string') {
    throw new InvalidPlaybookError('slug é obrigatório')
  }
  if (!SLUG_REGEX.test(input.slug)) {
    throw new InvalidPlaybookError(
      `slug inválido "${input.slug}" — use só [a-z0-9_-]`,
    )
  }
  if (!input.name || typeof input.name !== 'string' || !input.name.trim()) {
    throw new InvalidPlaybookError('name é obrigatório')
  }
  if (
    typeof input.workspaceId !== 'string' ||
    input.workspaceId.length === 0
  ) {
    throw new InvalidPlaybookError('workspaceId é obrigatório')
  }
  if (
    input.characterSlugs !== undefined &&
    !Array.isArray(input.characterSlugs)
  ) {
    throw new InvalidPlaybookError('characterSlugs deve ser array')
  }
  if (
    input.promptOverrides !== undefined &&
    (typeof input.promptOverrides !== 'object' ||
      Array.isArray(input.promptOverrides))
  ) {
    throw new InvalidPlaybookError('promptOverrides deve ser objeto')
  }
  if (typeof input.version !== 'number' || input.version < 1 || !Number.isInteger(input.version)) {
    throw new InvalidPlaybookError('version deve ser inteiro >= 1')
  }
  if (typeof input.isOfficial !== 'boolean') {
    throw new InvalidPlaybookError('isOfficial deve ser boolean')
  }
  if (
    input.defaults?.durationSec !== undefined &&
    (typeof input.defaults.durationSec !== 'number' ||
      input.defaults.durationSec <= 0)
  ) {
    throw new InvalidPlaybookError('defaults.durationSec deve ser > 0')
  }

  const now = new Date().toISOString()
  return {
    slug: input.slug,
    name: input.name.trim(),
    description: input.description?.trim(),
    workspaceId: input.workspaceId,
    styleProfileSlug: input.styleProfileSlug,
    characterSlugs: input.characterSlugs ?? [],
    promptOverrides: input.promptOverrides,
    defaults: input.defaults,
    forkedFromId: input.forkedFromId,
    isOfficial: input.isOfficial,
    version: input.version,
    createdBy: input.createdBy,
    updatedBy: input.updatedBy,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  }
}

/** Aplica edição: bumpa version e atualiza updatedAt. Preserva createdAt e isOfficial. */
export type PlaybookEditablePatch = Partial<
  Pick<
    Playbook,
    | 'name'
    | 'description'
    | 'styleProfileSlug'
    | 'characterSlugs'
    | 'promptOverrides'
    | 'defaults'
    | 'updatedBy'
  >
>

export function bumpPlaybookVersion(
  current: Playbook,
  changes: PlaybookEditablePatch,
): Playbook {
  return validatePlaybook({
    ...current,
    ...changes,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  })
}

/**
 * Cria fork (cópia editável) a partir de um playbook fonte. O
 * resultado é sempre um playbook NOVO com `version=1`,
 * `isOfficial=false` e `forkedFromId` apontando ao original.
 *
 * Caller decide o slug + workspace alvo — geralmente o mesmo
 * workspace (creator personaliza um playbook oficial).
 */
export function forkPlaybook(
  source: Playbook,
  params: {
    slug: string
    workspaceId: string
    createdBy?: string
    name?: string
  },
): Playbook {
  const now = new Date().toISOString()
  return validatePlaybook({
    slug: params.slug,
    name: params.name ?? source.name,
    description: source.description,
    workspaceId: params.workspaceId,
    styleProfileSlug: source.styleProfileSlug,
    characterSlugs: [...source.characterSlugs],
    promptOverrides: source.promptOverrides
      ? { ...source.promptOverrides }
      : undefined,
    defaults: source.defaults ? { ...source.defaults } : undefined,
    forkedFromId: source.slug,
    isOfficial: false,
    version: 1,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  })
}
