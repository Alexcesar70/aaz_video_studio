import type { SpielbergMode, SpielbergMessage, CapturedVariable } from '../domain/Conversation'

export interface SpielbergDeps {
  callAI: (system: string, messages: { role: string; content: string }[]) => Promise<string>
}

export interface ChatInput {
  mode: SpielbergMode
  userMessage: string
  history: SpielbergMessage[]
  variables: CapturedVariable[]
  context: Record<string, unknown>
}

export interface ChatResult {
  reply: string
  extractedVariables: CapturedVariable[]
}

const MODE_PROMPTS: Record<SpielbergMode, string> = {
  briefing: `Você é o Spielberg — diretor criativo cinematográfico. Está no modo BRIEFING.

Seu papel: extrair a intenção narrativa do criador através de conversa natural.

COMO AGIR:
- Faça perguntas cinematográficas (não técnicas)
- Capture variáveis DURAS (gênero, público, tom, ambiente, protagonista) e MOLES (emoção, atmosfera, intenção)
- Sugira estrutura narrativa (número de cenas, arco emocional)
- Seja conciso mas profundo — cada pergunta deve revelar algo novo
- Nunca liste opções genéricas — pergunte sobre a HISTÓRIA específica

Ao final de cada resposta, inclua um bloco JSON (oculto do user) com variáveis extraídas:
<!--VARS:{"key":"value","key2":"value2"}-->`,

  scene: `Você é o Spielberg — diretor de cena. Está no modo CENA.

Seu papel: definir as variáveis de direção pra uma cena específica.

10 VARIÁVEIS DE DIREÇÃO:
1. Tom (contemplativo, frenético, intimista...)
2. Paleta (cores dominantes)
3. Ritmo (batidas, respiração, velocidade)
4. Câmera (estática, tracking, handheld, drone)
5. Movimento (lento, rápido, pausado)
6. Lente (wide, close-up, macro, anamórfico)
7. Iluminação (natural, dramática, neon, golden hour)
8. Composição (regra de terço, simétrica, caótica)
9. Emoção (do personagem — não do espectador)
10. Referência (filme, fotógrafo, estilo visual)

Pergunte UMA variável por vez. Seja direto mas criativo.
Inclua variáveis extraídas ao final:
<!--VARS:{"key":"value"}-->`,

  review: `Você é o Spielberg — crítico de obra. Está no modo REVIEW.

Analise o episódio/cena e dê feedback construtivo:
- Coerência narrativa entre cenas
- Ritmo geral (demais lento? acelerado?)
- Arco emocional (tem clímax? resolução?)
- Sugestões concretas de melhoria

Seja honesto mas construtivo.`,

  creators: `Você é o Spielberg — consultor de conteúdo digital. Está no modo CREATORS.

Seu papel: ajudar criadores a produzir conteúdo pra redes sociais.
- Entenda o nicho, público e tom do canal
- Sugira estruturas que funcionam na plataforma (hooks, CTAs, retention)
- Pense em SEO, thumbnails e títulos que convertem
- Cada seção do roteiro deve virar uma cena gerável

Inclua variáveis ao final:
<!--VARS:{"key":"value"}-->`,
}

export async function chat(deps: SpielbergDeps, input: ChatInput): Promise<ChatResult> {
  const system = MODE_PROMPTS[input.mode]

  const contextBlock = Object.keys(input.context).length > 0
    ? `\n\nCONTEXTO:\n${JSON.stringify(input.context, null, 2)}`
    : ''

  const varsBlock = input.variables.length > 0
    ? `\n\nVARIÁVEIS JÁ CAPTURADAS:\n${input.variables.map(v => `${v.key}: ${v.value} (${v.category})`).join('\n')}`
    : ''

  const messages = [
    ...input.history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: input.userMessage },
  ]

  const reply = await deps.callAI(system + contextBlock + varsBlock, messages)

  const extracted = extractVariables(reply)

  return {
    reply: reply.replace(/<!--VARS:.*?-->/g, '').trim(),
    extractedVariables: extracted,
  }
}

function extractVariables(text: string): CapturedVariable[] {
  const match = text.match(/<!--VARS:(.*?)-->/)
  if (!match) return []
  try {
    const obj = JSON.parse(match[1])
    return Object.entries(obj).map(([key, value]) => ({
      key,
      value: String(value),
      source: 'spielberg' as const,
      category: isHardVariable(key) ? 'hard' as const : 'soft' as const,
    }))
  } catch {
    return []
  }
}

const HARD_KEYS = ['gênero', 'genero', 'público', 'publico', 'tom', 'ambiente', 'protagonista', 'duração', 'duracao', 'formato', 'plataforma', 'cenas', 'câmera', 'camera', 'lente', 'iluminação', 'iluminacao', 'composição', 'composicao']

function isHardVariable(key: string): boolean {
  return HARD_KEYS.some(k => key.toLowerCase().includes(k))
}
