/**
 * PromptTemplate — entidade de domínio.
 *
 * Representa um system prompt reutilizável (Scene Director, Lyrics Director,
 * etc.) armazenado no banco, substituindo as constantes hardcoded em
 * src/lib/*DirectorSystem.ts.
 *
 * Regras invariantes:
 *   - slug é único dentro do escopo (global OU por workspace).
 *   - content não pode ser vazio.
 *   - version é monotônica crescente (nunca decrementa).
 *   - workspaceId=null significa "template global" (default para todos os tenants).
 *   - workspaceId=<id> é override específico do workspace — vence sobre o global.
 *
 * Este módulo é **puro**: sem I/O, sem imports de infra.
 */

export type PromptTemplateKind =
  | 'scene_director'          // Claude → prompts de vídeo (PT-BR + EN)
  | 'image_director'          // Claude → prompts de imagem
  | 'image_style_block'       // bloco de estilo visual injetado em prompts de imagem
  | 'lyrics_director'         // Claude → letras de cantigas
  | 'storyboard_director'     // Claude → divisão da letra em cenas
  | 'song_prompt_generator'   // Claude → prompts de vídeo para storyboard

export const PROMPT_TEMPLATE_KINDS: readonly PromptTemplateKind[] = [
  'scene_director',
  'image_director',
  'image_style_block',
  'lyrics_director',
  'storyboard_director',
  'song_prompt_generator',
] as const

export interface PromptTemplate {
  slug: string
  kind: PromptTemplateKind
  content: string
  description?: string
  version: number
  workspaceId: string | null
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
  createdBy?: string
  updatedBy?: string
}

export class InvalidPromptTemplateError extends Error {
  constructor(message: string) {
    super(`Invalid PromptTemplate: ${message}`)
    this.name = 'InvalidPromptTemplateError'
  }
}

/**
 * Valida shape mínimo de um PromptTemplate antes de persistir.
 * Retorna o template normalizado ou lança InvalidPromptTemplateError.
 */
export function validatePromptTemplate(
  input: Partial<PromptTemplate>,
): PromptTemplate {
  if (!input.slug || typeof input.slug !== 'string') {
    throw new InvalidPromptTemplateError('slug é obrigatório')
  }
  if (!/^[a-z0-9_]+$/.test(input.slug)) {
    throw new InvalidPromptTemplateError(
      `slug inválido "${input.slug}" — use só [a-z0-9_]`,
    )
  }
  if (!input.kind || !PROMPT_TEMPLATE_KINDS.includes(input.kind)) {
    throw new InvalidPromptTemplateError(
      `kind inválido: ${String(input.kind)}`,
    )
  }
  if (typeof input.content !== 'string' || input.content.trim().length === 0) {
    throw new InvalidPromptTemplateError('content não pode ser vazio')
  }
  if (input.content.length > 100_000) {
    throw new InvalidPromptTemplateError(
      `content excede 100k chars (${input.content.length})`,
    )
  }
  if (typeof input.version !== 'number' || input.version < 1) {
    throw new InvalidPromptTemplateError('version deve ser inteiro >= 1')
  }
  if (
    input.workspaceId !== null &&
    (typeof input.workspaceId !== 'string' || input.workspaceId.length === 0)
  ) {
    throw new InvalidPromptTemplateError('workspaceId deve ser string ou null')
  }

  return {
    slug: input.slug,
    kind: input.kind,
    content: input.content,
    description: input.description,
    version: input.version,
    workspaceId: input.workspaceId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    createdBy: input.createdBy,
    updatedBy: input.updatedBy,
  }
}

/**
 * Gera a próxima versão do template ao atualizar.
 * Preserva createdAt e incrementa version + updatedAt.
 */
export function bumpVersion(
  current: PromptTemplate,
  changes: Partial<Pick<PromptTemplate, 'content' | 'description' | 'updatedBy'>>,
): PromptTemplate {
  const next: PromptTemplate = {
    ...current,
    ...changes,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
  }
  return validatePromptTemplate(next)
}
