/**
 * StyleProfile — entidade de domínio.
 *
 * Representa uma "receita visual" reutilizável que pode ser injetada
 * em prompts de geração (imagem e vídeo). Substitui o AAZ_STYLE_BLOCK
 * hardcoded em src/lib/imageDirectorSystem.ts.
 *
 * Arquitetura:
 *   - Profiles globais (workspaceId=null) são presets do sistema
 *     (ex.: clay-massinha, anime, cinematic-realism).
 *   - Profiles do workspace (workspaceId=<id>) são customizações ou
 *     forks feitos pelo Team Leader / Owner.
 *   - `forkedFromId` permite rastreabilidade quando um profile foi
 *     criado a partir de outro.
 *
 * Este módulo é PURO: sem I/O, sem imports de infra.
 */

export interface StyleProfile {
  /** Slug único dentro do escopo (global OU por workspace) */
  slug: string
  /** Nome humano — aparece no seletor da UI */
  name: string
  /** Descrição curta (1-2 frases) — aparece em tooltips */
  description?: string
  /**
   * O bloco textual que é injetado nos prompts de geração.
   * Este é o campo-chave: o que aparece literalmente no system prompt.
   */
  promptBlock: string
  /** URLs de imagens de referência visual (Vercel Blob) — opcional */
  referenceUrls?: string[]
  /** Se este profile foi forked a partir de outro, o slug do pai */
  forkedFromId?: string
  /** null = global/preset do sistema; string = dono o workspace */
  workspaceId: string | null
  /** Tags pra busca e filtro */
  tags?: string[]
  /**
   * true = preset oficial do sistema (não pode ser deletado).
   * false = criado por usuário (pode ser editado/removido).
   */
  isOfficial: boolean
  /** Versão monotônica — incrementa a cada edit de promptBlock */
  version: number
  /** Usuário criador (quando aplicável) */
  createdBy?: string
  /** Último usuário a editar */
  updatedBy?: string
  createdAt: string
  updatedAt: string
}

export class InvalidStyleProfileError extends Error {
  constructor(message: string) {
    super(`Invalid StyleProfile: ${message}`)
    this.name = 'InvalidStyleProfileError'
  }
}

/**
 * Valida shape mínimo antes de persistir. Retorna o profile normalizado
 * ou lança InvalidStyleProfileError.
 */
export function validateStyleProfile(
  input: Partial<StyleProfile>,
): StyleProfile {
  if (!input.slug || typeof input.slug !== 'string') {
    throw new InvalidStyleProfileError('slug é obrigatório')
  }
  if (!/^[a-z0-9_-]+$/.test(input.slug)) {
    throw new InvalidStyleProfileError(
      `slug inválido "${input.slug}" — use só [a-z0-9_-]`,
    )
  }
  if (!input.name?.trim()) {
    throw new InvalidStyleProfileError('name é obrigatório')
  }
  if (typeof input.promptBlock !== 'string' || input.promptBlock.trim().length === 0) {
    throw new InvalidStyleProfileError('promptBlock não pode ser vazio')
  }
  if (input.promptBlock.length > 20_000) {
    throw new InvalidStyleProfileError(
      `promptBlock excede 20k chars (${input.promptBlock.length})`,
    )
  }
  if (typeof input.version !== 'number' || input.version < 1) {
    throw new InvalidStyleProfileError('version deve ser inteiro >= 1')
  }
  if (
    input.workspaceId !== null &&
    (typeof input.workspaceId !== 'string' || input.workspaceId.length === 0)
  ) {
    throw new InvalidStyleProfileError('workspaceId deve ser string ou null')
  }
  if (typeof input.isOfficial !== 'boolean') {
    throw new InvalidStyleProfileError('isOfficial deve ser boolean')
  }
  if (
    input.referenceUrls !== undefined &&
    !Array.isArray(input.referenceUrls)
  ) {
    throw new InvalidStyleProfileError('referenceUrls deve ser array')
  }

  return {
    slug: input.slug,
    name: input.name.trim(),
    description: input.description?.trim(),
    promptBlock: input.promptBlock,
    referenceUrls: input.referenceUrls,
    forkedFromId: input.forkedFromId,
    workspaceId: input.workspaceId,
    tags: input.tags,
    isOfficial: input.isOfficial,
    version: input.version,
    createdBy: input.createdBy,
    updatedBy: input.updatedBy,
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  }
}

/**
 * Gera a próxima versão ao atualizar. Preserva createdAt e isOfficial;
 * incrementa version + updatedAt.
 */
export function bumpStyleProfileVersion(
  current: StyleProfile,
  changes: Partial<
    Pick<
      StyleProfile,
      'name' | 'description' | 'promptBlock' | 'referenceUrls' | 'tags' | 'updatedBy'
    >
  >,
): StyleProfile {
  const next: StyleProfile = {
    ...current,
    ...changes,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  }
  return validateStyleProfile(next)
}
