import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { getRedis } from '@/lib/redis'

export const maxDuration = 60

interface ScriptSection {
  title: string
  description: string
  duration: number
  visualDirection: string
}

interface GeneratedScript {
  title: string
  description: string
  sections: ScriptSection[]
  totalDuration: number
  seoTitle?: string
  seoDescription?: string
  hashtags?: string[]
  thumbnailPrompt?: string
}

const PLATFORM_CONFIGS: Record<string, { ratio: string; maxSections: number; style: string }> = {
  youtube: { ratio: '16:9', maxSections: 8, style: 'roteiro completo com introdução, desenvolvimento e conclusão' },
  'youtube-shorts': { ratio: '9:16', maxSections: 4, style: 'conteúdo vertical curto com hook forte nos primeiros 2 segundos' },
  tiktok: { ratio: '9:16', maxSections: 4, style: 'conteúdo vertical com hook nos primeiros 3 segundos, cortes rápidos, linguagem jovem' },
  instagram: { ratio: '9:16', maxSections: 5, style: 'reel vertical com visual impactante e texto overlay' },
  'instagram-carousel': { ratio: '1:1', maxSections: 6, style: 'carrossel de imagens com texto educativo, cada slide autocontido' },
  'instagram-story': { ratio: '9:16', maxSections: 4, style: 'sequência de stories de 15s cada, direto ao ponto' },
}

function buildSystemPrompt(platform: string, format: string): string {
  const config = PLATFORM_CONFIGS[`${platform}-${format}`.toLowerCase().replace(/\s+/g, '-')]
    ?? PLATFORM_CONFIGS[platform]
    ?? PLATFORM_CONFIGS.youtube

  return `Você é o Spielberg — diretor criativo especialista em conteúdo pra redes sociais.

Sua tarefa: criar um roteiro detalhado e estruturado pra um vídeo no formato ${config.ratio}.

Estilo: ${config.style}.

REGRAS:
- Divida em NO MÁXIMO ${config.maxSections} seções/cenas
- Cada seção deve ter: título curto, descrição detalhada do que acontece visualmente, duração em segundos, e direção visual (ângulo de câmera, iluminação, movimento)
- A primeira seção SEMPRE deve ter um hook forte que prenda atenção
- A última seção deve ter call-to-action ou fechamento memorável
- Gere também: título SEO, descrição SEO curta, 5-8 hashtags relevantes, e um prompt pra gerar thumbnail

Responda EXCLUSIVAMENTE em JSON válido neste formato:
{
  "title": "título do vídeo",
  "description": "descrição curta do conceito",
  "sections": [
    {
      "title": "nome da seção",
      "description": "o que acontece visualmente nesta cena — detalhado",
      "duration": 5,
      "visualDirection": "câmera frontal, iluminação quente, movimento lento de aproximação"
    }
  ],
  "totalDuration": 30,
  "seoTitle": "título otimizado pra busca",
  "seoDescription": "descrição pra SEO em 160 caracteres",
  "hashtags": ["#tag1", "#tag2"],
  "thumbnailPrompt": "prompt pra gerar thumbnail atraente"
}`
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request)

    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 })
    }

    const body = await request.json() as {
      platform?: string
      format?: string
      topic?: string
      audience?: string
      tone?: string
      notes?: string
    }

    if (!body.platform || !body.topic?.trim()) {
      return NextResponse.json({ error: 'platform e topic são obrigatórios.' }, { status: 400 })
    }

    const userMessage = [
      `Plataforma: ${body.platform}`,
      body.format ? `Formato: ${body.format}` : '',
      `Tema: ${body.topic}`,
      body.audience ? `Público-alvo: ${body.audience}` : '',
      body.tone ? `Tom: ${body.tone}` : '',
      body.notes ? `Notas adicionais: ${body.notes}` : '',
    ].filter(Boolean).join('\n')

    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514'

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: buildSystemPrompt(body.platform, body.format ?? ''),
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({})) as { error?: { message?: string } }
      return NextResponse.json(
        { error: err?.error?.message ?? `Claude API retornou ${claudeRes.status}` },
        { status: claudeRes.status },
      )
    }

    const claudeData = await claudeRes.json() as {
      content: { type: string; text: string }[]
    }

    const text = claudeData.content?.find(c => c.type === 'text')?.text?.trim()
    if (!text) {
      return NextResponse.json({ error: 'Spielberg não retornou roteiro.' }, { status: 502 })
    }

    let script: GeneratedScript
    try {
      const match = text.match(/\{[\s\S]*\}/)
      script = JSON.parse(match ? match[0] : text)
    } catch {
      return NextResponse.json({ error: 'Roteiro em formato inválido.', raw: text }, { status: 502 })
    }

    // Auto-criar projeto + episódio + cenas
    const redis = await getRedis()
    const now = new Date().toISOString()
    const projectId = `prj_${Date.now()}`
    const episodeId = `ep_${Date.now()}`

    const project = {
      id: projectId,
      name: `${body.platform.toUpperCase()} · ${script.title}`,
      createdAt: now,
      createdBy: user.id,
      organizationId: user.organizationId,
    }
    await redis.set(`aaz:project:${projectId}`, JSON.stringify(project))

    const episode = {
      id: episodeId,
      name: script.title,
      projectId,
      createdAt: now,
      createdBy: user.id,
      organizationId: user.organizationId,
    }
    await redis.set(`aaz:ep:${episodeId}`, JSON.stringify(episode))

    const config = PLATFORM_CONFIGS[`${body.platform}-${(body.format ?? '').toLowerCase().replace(/\s+/g, '-')}`]
      ?? PLATFORM_CONFIGS[body.platform]
      ?? PLATFORM_CONFIGS.youtube

    const scenes = script.sections.map((section, i) => {
      const sceneId = `scene_${Date.now()}_${i}`
      return {
        id: sceneId,
        episodeId,
        sceneNumber: i + 1,
        title: section.title,
        prompt: `${section.description}\n\nDireção visual: ${section.visualDirection}`,
        videoUrl: '',
        lastFrameUrl: '',
        characters: [],
        duration: section.duration,
        cost: '0',
        createdAt: now,
        createdBy: user.id,
        organizationId: user.organizationId,
        status: 'draft',
      }
    })

    for (const scene of scenes) {
      await redis.set(`aaz:scene:${episodeId}:${scene.id}`, JSON.stringify(scene))
    }

    return NextResponse.json({
      ok: true,
      script,
      project: { id: projectId, name: project.name },
      episode: { id: episodeId, name: episode.name },
      scenes: scenes.map(s => ({ id: s.id, title: s.title, prompt: s.prompt, duration: s.duration })),
      ratio: config.ratio,
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[POST /api/creators/generate-script]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
