import { NextRequest, NextResponse } from 'next/server'
import { getSceneDirectorSystem, type ChainFromContext } from '@/lib/sceneDirectorSystem'
import { getMood } from '@/lib/moods'

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
    parts.push(`The creator wrote this scene description (in Portuguese, may contain @charid references):`)
    parts.push(body.scene_description)
    parts.push('')

    if (body.characters?.length) {
      const ids = (body.characters as string[]).map(c => `@${c}`).join(', ')
      parts.push(`Characters in this scene (write as tags in the prompt): ${ids}`)
      parts.push(`CRITICAL: Every time you reference these characters in Dynamic Description, Static Description, or Audio, use the @id tag (not the name). These tags link to Omni Reference images.`)
    }
    if (body.setting) {
      parts.push(`Setting / location: ${body.setting}`)
    }
    if (body.duration) {
      parts.push(`Target video duration: ${body.duration} seconds — calibrate the number of beats accordingly.`)
    }
    if (body.emotion) {
      parts.push(`Emotional tone / conflict (expressed as body physics — NOT as visual mood): ${body.emotion}`)
    }
    if (body.mood) {
      const mood = getMood(body.mood)
      if (mood.videoPromptInjection) {
        parts.push(`Visual mood (lighting/palette/atmosphere — applied to Style & Mood block): ${mood.shortLabel} — ${mood.narrative}`)
      }
    }

    // Chain context — se esta cena é continuação de outra, o cliente
    // envia o objeto chain_from que vira contexto pro Claude.
    const chainFrom = body.chain_from as ChainFromContext | null | undefined
    if (chainFrom) {
      parts.push('')
      parts.push(`This is a DIRECT CONTINUATION of scene #${chainFrom.sceneNumber}${chainFrom.sceneTitle ? ` "${chainFrom.sceneTitle}"` : ''}. See the CONTINUATION CONTEXT block in the system prompt for full details.`)
    }

    parts.push('')
    parts.push('REMINDERS:')
    parts.push('- If the creator included dialogue (even implied), preserve it verbatim in the Audio section.')
    parts.push('- Use @charid tags for every character mention.')
    parts.push('- Mood = visual lighting/atmosphere (goes in Style & Mood block). Emotion = character body physics (goes in Dynamic Description). They can contrast.')
    parts.push('- Return ONLY the JSON array with PT-BR and EN objects, each with the 4 sections.')

    const userMessage = parts.join('\n')

    // ── Chamada à Claude API com retry em overloaded ──────────
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514'
    const systemPrompt = getSceneDirectorSystem(body.mood, chainFrom ?? null)
    const requestBody = JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
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
