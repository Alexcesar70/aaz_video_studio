import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/generate-sheet
 * Proxy server-side para Segmind Consistent Character AI Neolemon V3
 * Gera character sheet multi-pose a partir de prompt + imagem de referência
 */

export const maxDuration = 300

const FETCH_TIMEOUT_MS = 290_000

const ENDPOINT = 'https://api.segmind.com/v1/consistent-character-AI-neolemon-v3'

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.SEGMIND_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'SEGMIND_API_KEY não configurada no servidor.' },
        { status: 500 }
      )
    }

    const body = await request.json()

    if (!body.character_name?.trim()) {
      return NextResponse.json({ error: 'character_name é obrigatório.' }, { status: 400 })
    }

    // Monta o prompt descritivo do personagem
    const prompt = body.prompt || `${body.character_name} character sheet, multiple poses, full body, front view, side view, back view, 3/4 view, clay texture, 3D animation style, expressive eyes, rounded proportions, warm palette, white background`

    // Monta payload para Neolemon V3
    const payload: Record<string, unknown> = {
      prompt,
      steps: 10,
      guidance_scale: 3,
      width: 1024,
      height: 1024,
      seed: body.seed ?? Math.floor(Math.random() * 999999),
    }

    // ip_image aceita apenas URLs públicas — se for base64, faz upload primeiro
    if (body.reference_images?.length) {
      const img = body.reference_images[0] as string
      if (img.startsWith('http')) {
        payload.ip_image = img
      } else if (img.startsWith('data:')) {
        // Upload base64 para Segmind Storage e pega a URL pública
        const uploadRes = await fetch('https://api.segmind.com/v1/upload-image', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image: img }),
        })
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json() as { url?: string; image_url?: string }
          const publicUrl = uploadData.url ?? uploadData.image_url
          if (publicUrl) payload.ip_image = publicUrl
        }
      }
    }

    // ── Chamada ao Segmind (sem retry para evitar cobrança dupla) ──
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    let segmindRes: Response
    try {
      segmindRes = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return NextResponse.json({ error: 'Segmind não respondeu no tempo limite (110s).' }, { status: 504 })
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }

    if (!segmindRes.ok) {
      const errorData = await segmindRes.json().catch(() => ({}))
      const message = (errorData as { detail?: string; error?: string })?.detail
        ?? (errorData as { detail?: string; error?: string })?.error
        ?? `Segmind retornou ${segmindRes.status}`
      return NextResponse.json({ error: message }, { status: segmindRes.status })
    }

    const imageBlob = await segmindRes.arrayBuffer()

    return new NextResponse(imageBlob, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="sheet-${body.character_id ?? 'char'}.png"`,
        'Cache-Control': 'no-store',
      },
    })

  } catch (err) {
    console.error('[/api/generate-sheet]', err)
    const message = err instanceof Error ? err.message : 'Erro interno ao processar a requisição.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
