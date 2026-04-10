import { NextRequest, NextResponse } from 'next/server'
import { SCENE_DIRECTOR_SYSTEM } from '@/lib/sceneDirectorSystem'

/**
 * POST /api/scene-director
 * Gera prompts trilíngues (PT-BR + ES + EN) via Claude API
 */

interface ScenePrompt {
  lang: string
  prompt: string
}

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

    // ── Monta o user message ────────────────────────────────────
    const parts: string[] = []
    parts.push(`Scene description: ${body.scene_description}`)

    if (body.characters?.length) {
      parts.push(`Characters in this scene: ${body.characters.join(', ')}`)
    }
    if (body.setting) {
      parts.push(`Setting: ${body.setting}`)
    }
    if (body.duration) {
      parts.push(`Video duration: ${body.duration} seconds`)
    }
    if (body.emotion) {
      parts.push(`Emotional conflict: ${body.emotion}`)
    }

    const userMessage = parts.join('\n')

    // ── Chamada à Claude API com retry em overloaded ──────────
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514'
    const requestBody = JSON.stringify({
      model,
      max_tokens: 4096,
      system: SCENE_DIRECTOR_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    })

    let claudeRes: Response | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: requestBody,
      })

      if (claudeRes.status === 529) {
        // Overloaded — espera e tenta de novo
        await new Promise(r => setTimeout(r, 3000 * (attempt + 1)))
        continue
      }
      break
    }

    if (!claudeRes || !claudeRes.ok) {
      const err = claudeRes ? await claudeRes.json().catch(() => ({})) : {}
      const message = (err as { error?: { message?: string } })?.error?.message
        ?? `Claude API retornou ${claudeRes?.status ?? 'sem resposta'}`
      return NextResponse.json({ error: message }, { status: claudeRes?.status ?? 502 })
    }

    const claudeData = await claudeRes.json() as {
      content: { type: string; text: string }[]
    }

    const text = claudeData.content
      ?.find(c => c.type === 'text')
      ?.text?.trim()

    if (!text) {
      return NextResponse.json(
        { error: 'Claude não retornou texto.' },
        { status: 502 }
      )
    }

    // ── Parse do JSON ───────────────────────────────────────────
    let prompts: ScenePrompt[]
    try {
      prompts = JSON.parse(text)
    } catch {
      // Tenta extrair JSON de dentro de code fences
      const match = text.match(/\[[\s\S]*\]/)
      if (!match) {
        return NextResponse.json(
          { error: 'Claude retornou formato inválido.', raw: text },
          { status: 502 }
        )
      }
      prompts = JSON.parse(match[0])
    }

    if (!Array.isArray(prompts) || prompts.length < 2) {
      return NextResponse.json(
        { error: 'Claude retornou array com tamanho incorreto.', raw: text },
        { status: 502 }
      )
    }

    return NextResponse.json({ prompts })

  } catch (err) {
    console.error('[/api/scene-director]', err)
    const message = err instanceof Error ? err.message : 'Erro interno ao processar a requisição.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
