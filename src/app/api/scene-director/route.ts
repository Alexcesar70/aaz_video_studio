import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/scene-director
 * Gera prompts trilíngues (PT-BR + ES + EN) via Claude API
 * usando o skill AAZ com Jesus — Scene Director for Seedance 2.0
 *
 * Body esperado:
 * {
 *   scene_description: string   // texto livre descrevendo a cena
 *   characters?: string[]       // ex: ["abraao", "abigail", "tuba"]
 *   setting?: string            // ex: "clube_da_aliança" | "casa_miriam_elias" | texto livre
 *   duration?: number           // 10 | 12 | 15 (default: 10)
 *   emotion?: string            // conflito emocional em jogo (opcional)
 * }
 *
 * Resposta:
 * {
 *   prompts: [
 *     { lang: "pt-br", prompt: string },
 *     { lang: "es",    prompt: string },
 *     { lang: "en",    prompt: string },
 *   ]
 * }
 *
 * TODO Fase 4 (Alexandre):
 *  - Carregar o SKILL.md completo como system prompt
 *  - Montar o user message com scene_description + characters + setting
 *  - Chamar claude-sonnet-4-20250514 com max_tokens: 4096
 *  - Fazer parse do JSON retornado [{lang, prompt}, ...]
 *  - Retornar { prompts } para o frontend injetar nas 3 abas
 */

// O system prompt completo está em src/lib/sceneDirectorSystem.ts
// (gerado na Fase 4 a partir do SKILL.md)

export async function POST(request: NextRequest) {
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY não configurada no servidor.' },
        { status: 500 }
      )
    }

    const body = await request.json()

    if (!body.scene_description?.trim()) {
      return NextResponse.json(
        { error: 'scene_description é obrigatório.' },
        { status: 400 }
      )
    }

    // Placeholder — Fase 4 implementa a chamada real
    // Retorna estrutura correta para o frontend já poder consumir
    return NextResponse.json({
      prompts: [
        { lang: 'pt-br', prompt: `[Scene Director: Fase 4 pendente] ${body.scene_description}` },
        { lang: 'es',    prompt: `[Scene Director: Fase 4 pendiente] ${body.scene_description}` },
        { lang: 'en',    prompt: `[Scene Director: Phase 4 pending] ${body.scene_description}` },
      ],
    })

  } catch (err) {
    console.error('[/api/scene-director]', err)
    return NextResponse.json(
      { error: 'Erro interno ao processar a requisição.' },
      { status: 500 }
    )
  }
}
