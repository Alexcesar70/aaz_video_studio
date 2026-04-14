/**
 * Character — entidade de domínio para personagens reutilizáveis da
 * biblioteca. Sucessor do shape `Asset { type: 'character', ... }`
 * definido em `@/lib/assets`.
 *
 * Diferenças em relação ao modelo legado:
 *   - Tipagem dedicada, não compartilhada com cenários/itens.
 *   - Campo `version` monotônico — toda edição incrementa.
 *   - `promptBlock` opcional: descrição estática injetada nos prompts
 *     (equivalente ao "Static Description" usado pelo Scene Director).
 *   - `forkedFromId` permite rastrear linhagem (Fork → edit → fork de novo).
 *
 * Arquitetura de escopo:
 *   - Characters globais (`workspaceId=null`): presets do sistema
 *     (ex.: os 7 leads do AAZ com Jesus).
 *   - Characters do workspace: criados pelo próprio workspace, podem
 *     ser forkados dos globais.
 *
 * Este módulo é **puro**: sem I/O, sem imports de infra.
 */

export interface Character {
  /** Slug único dentro do escopo (global OU por workspace). */
  slug: string
  /** Nome humano exibido na UI ("Abraão"). */
  name: string
  /** Descrição curta (1-2 frases) que vai em tooltips. */
  description?: string
  /**
   * Bloco textual injetado nos prompts de geração — tipicamente a
   * descrição visual canônica do personagem (altura, cor do cabelo,
   * traços, roupa). Equivalente ao "Static Description" legado.
   */
  promptBlock?: string
  /** URLs de imagens de referência no Vercel Blob. */
  imageUrls: string[]
  /** Emoji opcional para a UI. */
  emoji?: string
  /** Tags para busca e filtro. */
  tags?: string[]
  /** Se este character foi forked a partir de outro, o slug do pai. */
  forkedFromId?: string
  /** null = global/preset do sistema; string = workspace-owned. */
  workspaceId: string | null
  /**
   * true = preset oficial (não pode ser deletado nem editado exceto
   * pelo admin do sistema). false = criado por usuário.
   */
  isOfficial: boolean
  /** Versão monotônica — incrementa a cada edição. */
  version: number
  /** Usuário criador. */
  createdBy?: string
  /** Último usuário a editar. */
  updatedBy?: string
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

export class InvalidCharacterError extends Error {
  constructor(message: string) {
    super(`Invalid Character: ${message}`)
    this.name = 'InvalidCharacterError'
  }
}

const SLUG_REGEX = /^[a-z0-9_-]+$/

/**
 * Valida shape mínimo antes de persistir. Retorna normalizado ou
 * lança `InvalidCharacterError`.
 */
export function validateCharacter(input: Partial<Character>): Character {
  if (!input.slug || typeof input.slug !== 'string') {
    throw new InvalidCharacterError('slug é obrigatório')
  }
  if (!SLUG_REGEX.test(input.slug)) {
    throw new InvalidCharacterError(
      `slug inválido "${input.slug}" — use só [a-z0-9_-]`,
    )
  }
  if (!input.name || typeof input.name !== 'string' || !input.name.trim()) {
    throw new InvalidCharacterError('name é obrigatório')
  }
  if (!Array.isArray(input.imageUrls)) {
    throw new InvalidCharacterError('imageUrls deve ser array')
  }
  if (
    input.promptBlock !== undefined &&
    typeof input.promptBlock === 'string' &&
    input.promptBlock.length > 20_000
  ) {
    throw new InvalidCharacterError(
      `promptBlock excede 20k chars (${input.promptBlock.length})`,
    )
  }
  if (typeof input.version !== 'number' || input.version < 1 || !Number.isInteger(input.version)) {
    throw new InvalidCharacterError('version deve ser inteiro >= 1')
  }
  if (
    input.workspaceId !== null &&
    (typeof input.workspaceId !== 'string' || input.workspaceId.length === 0)
  ) {
    throw new InvalidCharacterError('workspaceId deve ser string ou null')
  }
  if (typeof input.isOfficial !== 'boolean') {
    throw new InvalidCharacterError('isOfficial deve ser boolean')
  }

  const now = new Date().toISOString()
  return {
    slug: input.slug,
    name: input.name.trim(),
    description: input.description?.trim(),
    promptBlock: input.promptBlock,
    imageUrls: input.imageUrls,
    emoji: input.emoji,
    tags: input.tags,
    forkedFromId: input.forkedFromId,
    workspaceId: input.workspaceId,
    isOfficial: input.isOfficial,
    version: input.version,
    createdBy: input.createdBy,
    updatedBy: input.updatedBy,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  }
}

/**
 * Aplica uma edição ao character: incrementa `version`, atualiza
 * `updatedAt` e opcionalmente `updatedBy`. Preserva `createdAt`,
 * `isOfficial`, `workspaceId`, `forkedFromId`.
 */
export type CharacterEditablePatch = Partial<
  Pick<
    Character,
    | 'name'
    | 'description'
    | 'promptBlock'
    | 'imageUrls'
    | 'emoji'
    | 'tags'
    | 'updatedBy'
  >
>

export function bumpCharacterVersion(
  current: Character,
  changes: CharacterEditablePatch,
): Character {
  const next: Character = {
    ...current,
    ...changes,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  }
  return validateCharacter(next)
}

/**
 * Cria um novo Character a partir de outro, preservando a linhagem via
 * `forkedFromId`. A cópia sempre começa em `version=1` (novo objeto) e
 * com `isOfficial=false` (só admins promovem a oficial depois).
 *
 * Nota: este helper é puro — a decisão de workspaceId/slug do novo
 * character vem do caller, que conhece o usuário autenticado.
 */
export function forkCharacter(
  source: Character,
  params: {
    slug: string
    workspaceId: string | null
    createdBy?: string
    name?: string
  },
): Character {
  const now = new Date().toISOString()
  return validateCharacter({
    slug: params.slug,
    name: params.name ?? source.name,
    description: source.description,
    promptBlock: source.promptBlock,
    imageUrls: [...source.imageUrls],
    emoji: source.emoji,
    tags: source.tags ? [...source.tags] : undefined,
    forkedFromId: source.slug,
    workspaceId: params.workspaceId,
    isOfficial: false,
    version: 1,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  })
}
