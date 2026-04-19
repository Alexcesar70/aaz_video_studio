/**
 * Utilitários puros que adaptam o prompt do user antes de enviar
 * ao Seedance. Sem I/O, sem dependências — testáveis isoladamente.
 */

/**
 * Detecta trechos entre aspas ("...", '...', "...", '...') no prompt
 * e os transforma em uma diretiva explícita de fala com lip-sync.
 *
 * Problema que resolve:
 *   Prompt natural "Mulher diz 'oi tudo bem'" → Seedance trata tudo
 *   como descrição de cena e gera só movimento (sem TTS).
 *
 * Solução:
 *   Reformata pra "Mulher. Dialogue (spoken in Brazilian Portuguese
 *   with phoneme-accurate lip-sync): 'oi tudo bem'" — esse formato
 *   dispara a geração de fala sincronizada no Seedance.
 *
 * Detecção de idioma é heurística simples (palavras comuns em PT-BR).
 * Se não bater português, assume inglês.
 */
export function shapeDialoguePrompt(rawPrompt: string): string {
  if (!rawPrompt) return rawPrompt

  // Match aspas retas ou "smart quotes" em qualquer ordem. Usa
  // [\s\S] em vez de flag /s (que exige ES2018+ no tsconfig).
  const quoteMatch = rawPrompt.match(/["""'"]([\s\S]+?)["""'"]/)
  if (!quoteMatch) return rawPrompt

  const dialogue = quoteMatch[1].trim()
  if (!dialogue) return rawPrompt

  // Remove a parte da aspa + conectores típicos ("diz:", "fala:", "says:")
  const scene = rawPrompt
    .replace(quoteMatch[0], '')
    .replace(/\s*(?:e\s+)?(?:diz|fala|says|says to\s+\w+|responde|answers|replies)\s*[:,]?\s*$/i, '')
    .trim()
    .replace(/[.,;]+$/, '')

  const lang = detectLanguage(rawPrompt)

  const prefix = scene.length > 0 ? `${scene}. ` : ''
  return `${prefix}Dialogue (spoken in ${lang} with phoneme-accurate lip-sync): "${dialogue}"`
}

/**
 * Heurística simples — se contém palavras comuns de PT-BR, assume
 * Brazilian Portuguese; senão, English.
 */
function detectLanguage(text: string): string {
  const portugueseMarkers = /\b(mulher|homem|menino|menina|ela|ele|vira|diz|fala|para|pra|na|no|do|da|que|se|seu|sua|olha|está|é o|é a|uma|um|com|vai|tem|foi|ser|estou|você|voce)\b/i
  if (portugueseMarkers.test(text)) return 'Brazilian Portuguese'
  return 'English'
}
