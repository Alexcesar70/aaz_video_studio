import { NextRequest, NextResponse } from 'next/server'
import { SCENE_DIRECTOR_SYSTEM } from '@/lib/sceneDirectorSystem'

/**
 * POST /api/scene-director
 * Gera prompts (PT-BR + EN) via Claude API
 *
 * Aceita dois formatos:
 * 1) Legado: { scene_description, characters, setting, duration, emotion }
 * 2) Novo (Shot): {
 *      shot: { action, emotion, camera_fixed?, camera_movement?, duration },
 *      scene: { name, general_action, scenario_name?, scenario_desc? },
 *      episode: { title, synopsis, characters_desc[] }
 *    }
 */

interface ScenePrompt { lang: string; prompt: string }

function buildUserMessage(body: Record<string, unknown>): string {
  // Novo formato (shot)
  if (body.shot) {
    const shot = body.shot as {
      action: string; emotion: string;
      camera_fixed?: string; camera_movement?: string;
      duration: number;
    }
    const scene = body.scene as {
      name: string; general_action: string;
      scenario_name?: string; scenario_desc?: string;
    }
    const episode = body.episode as {
      title: string; synopsis: string;
      characters_desc: string[];
    }

    const parts: string[] = []
    parts.push('## EPISODE CONTEXT')
    parts.push(`Title: ${episode.title}`)
    if (episode.synopsis) parts.push(`Synopsis: ${episode.synopsis}`)
    if (episode.characters_desc?.length) {
      parts.push('Characters involved:')
      episode.characters_desc.forEach(c => parts.push(`- ${c}`))
    }

    parts.push('\n## SCENE CONTEXT')
    parts.push(`Scene name: ${scene.name}`)
    if (scene.scenario_name) parts.push(`Location: ${scene.scenario_name}`)
    if (scene.scenario_desc) parts.push(`Location description: ${scene.scenario_desc}`)
    if (scene.general_action) parts.push(`General action of the scene: ${scene.general_action}`)

    parts.push('\n## SHOT — THIS IS WHAT YOU ARE WRITING')
    parts.push(`Specific beat action: ${shot.action}`)
    parts.push(`Emotional tone: ${shot.emotion}`)
    if (shot.camera_fixed) {
      parts.push(`Camera (fixed): ${shot.camera_fixed}`)
    } else if (shot.camera_movement) {
      parts.push(`Camera movement (translate to Seedance technical terms like dolly, push-in, crane, aerial, pan, tilt): ${shot.camera_movement}`)
    }
    parts.push(`Duration: ${shot.duration} seconds`)

    parts.push('\nGenerate the PT-BR and EN Seedance 2.0 prompts for THIS SHOT, using all the context above. Include full character appearances for characters present in the scene.')

    return parts.join('\n')
  }

  // Formato legado
  const parts: string[] = []
  parts.push(`Scene description: ${body.scene_description}`)
  if (Array.isArray(body.characters) && body.characters.length) parts.push(`Characters: ${(body.characters as string[]).join(', ')}`)
  if (body.setting) parts.push(`Setting: ${body.setting}`)
  if (body.duration) parts.push(`Duration: ${body.duration}s`)
  if (body.emotion) parts.push(`Emotion: ${body.emotion}`)
  return parts.join('\n')
}

export async function POST(request: NextRequest) {
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 })
    }

    const body = await request.json()

    if (!body.shot && !body.scene_description?.trim()) {
      return NextResponse.json({ error: 'scene_description ou shot é obrigatório.' }, { status: 400 })
    }

    const userMessage = buildUserMessage(body)

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

    const claudeData = await claudeRes.json() as { content: { type: string; text: string }[] }
    const text = claudeData.content?.find(c => c.type === 'text')?.text?.trim()

    if (!text) {
      return NextResponse.json({ error: 'Claude não retornou texto.' }, { status: 502 })
    }

    let prompts: ScenePrompt[]
    try {
      prompts = JSON.parse(text)
    } catch {
      const match = text.match(/\[[\s\S]*\]/)
      if (!match) return NextResponse.json({ error: 'Formato inválido.', raw: text }, { status: 502 })
      prompts = JSON.parse(match[0])
    }

    if (!Array.isArray(prompts) || prompts.length < 2) {
      return NextResponse.json({ error: 'Array com tamanho incorreto.', raw: text }, { status: 502 })
    }

    return NextResponse.json({ prompts })

  } catch (err) {
    console.error('[/api/scene-director]', err)
    const message = err instanceof Error ? err.message : 'Erro interno.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
