/**
 * Regras puras de compatibilidade entre tipos de dado do Workflow.
 * Função sem dependências — testável isoladamente, plugável em
 * qualquer camada (UI validation, drag feedback, server-side check).
 *
 * Princípio: cada DataType define explicitamente quais targets aceita.
 * A matriz aqui é a única fonte de verdade. Alterar a matriz é o
 * suficiente pra propagar nova regra ao canvas inteiro.
 */

import type { DataType } from './nodeTypeMeta'

/**
 * Matriz de compatibilidade: `source → targets aceitos`.
 * - `text`: prompt/nota livre → pode ir pra qualquer gerador (img, video, SP, assistant)
 * - `prompt`: prompt refinado (SmartPrompter out) → idem texto
 * - `image`: imagem pronta → pode alimentar gerador de imagem (edit/ref) ou vídeo (frame/ref)
 * - `video`: vídeo pronto → só outro gerador de vídeo (ref/video-to-video)
 * - `any`: saída genérica (reference/upload) → aceita em qualquer entrada compatível
 */
const COMPAT_MATRIX: Record<DataType, DataType[]> = {
  text: ['text', 'prompt', 'any'],
  prompt: ['text', 'prompt', 'any'],
  image: ['image', 'any'],
  video: ['video', 'any'],
  any: ['text', 'prompt', 'image', 'video', 'any'],
}

/**
 * Retorna se um output de tipo `source` pode ligar em um input de tipo `target`.
 * Bi-direcionalmente permissivo com `any`: `any` sempre conecta.
 */
export function isCompatibleConnection(source: DataType, target: DataType): boolean {
  if (source === 'any' || target === 'any') return true
  return COMPAT_MATRIX[source]?.includes(target) ?? false
}
