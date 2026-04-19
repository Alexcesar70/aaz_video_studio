/**
 * Utilitários puros que adaptam o prompt do user antes de enviar
 * ao Seedance. Sem I/O, sem dependências — testáveis isoladamente.
 */

/**
 * Detecta trechos entre aspas no prompt e os transforma no formato
 * que o Seedance reconhece como TTS+lip-sync.
 *
 * Problema que resolve:
 *   Prompt natural "Mulher diz 'oi tudo bem'" → Seedance trata tudo
 *   como descrição de cena e gera só movimento (sem TTS).
 *
 * Padrão AAZ que FUNCIONA (copiado do Scene Director):
 *
 *   [descrição da cena]. @image1 says in Brazilian Portuguese:
 *   "frase exata". Audio: @image1: "frase exata".
 *
 * A REPETIÇÃO do diálogo — primeiro inline na ação, depois num
 * bloco "Audio:" — é o que dispara o speech generation no Seedance.
 * Sem o bloco Audio, ele gera só ambient sound.
 *
 * Se o caller sabe que há ref image, passa `speakerTag='@image1'`.
 * Sem ref, usa fallback 'The person in the scene'.
 */
export function shapeDialoguePrompt(
  rawPrompt: string,
  speakerTag: string = '@image1',
): string {
  if (!rawPrompt) return rawPrompt

  // Match aspas retas ou "smart quotes" em qualquer ordem. Usa
  // [\s\S] em vez de flag /s (que exige ES2018+ no tsconfig).
  const quoteMatch = rawPrompt.match(/["""'"]([\s\S]+?)["""'"]/)
  if (!quoteMatch) return rawPrompt

  const dialogue = quoteMatch[1].trim()
  if (!dialogue) return rawPrompt

  // Remove a aspa + conectores redundantes que o user já escreveu,
  // tipo "...e diz em portugues do Brasil:", "says in English:",
  // "fala:", "responde:". A gente vai reconstruir esses nos padrões
  // canônicos do Seedance.
  let scene = rawPrompt.replace(quoteMatch[0], '').trim()

  // PT: "e diz/fala/responde [em/no/na <idioma>]:"
  scene = scene
    .replace(/\s*(?:e\s+)?(?:diz|fala|responde)(?:\s+(?:em|no|na)\s+[^,:.]+?)?[:,]?$/i, '')
    .replace(/\s*(?:says?|speaks?|answers?|replies)(?:\s+(?:in|with)\s+[^,:.]+?)?[:,]?$/i, '')
    .trim()
    .replace(/[.,;:]+$/, '')
    .trim()

  const lang = detectLanguage(rawPrompt)
  const prefix = scene.length > 0 ? `${scene}. ` : ''

  // Formato canônico do Scene Director do AAZ:
  //   inline: "@image1 says in X with phoneme-accurate lip-sync: ..."
  //   audio:  "Audio: @image1: ..."
  // A repetição é intencional e necessária pro TTS disparar.
  return (
    `${prefix}${speakerTag} says in ${lang} with phoneme-accurate lip-sync: "${dialogue}". ` +
    `Audio: ${speakerTag}: "${dialogue}".`
  )
}

/**
 * Heurística simples — se contém palavras comuns de PT-BR, assume
 * Brazilian Portuguese; senão, English.
 */
function detectLanguage(text: string): string {
  const portugueseMarkers = /\b(mulher|homem|menino|menina|ela|ele|vira|diz|fala|para|pra|na|no|do|da|que|se|seu|sua|olha|está|é o|é a|uma|um|com|vai|tem|foi|ser|estou|você|voce|portugu[eê]s|brasil)\b/i
  if (portugueseMarkers.test(text)) return 'Brazilian Portuguese'
  return 'English'
}
