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

    const prompt = body.prompt || `${body.character_name} character sheet, multiple poses, full body, front view, side view, back view, 3/4 view, clay texture, 3D animation style, expressive eyes, rounded proportions, warm palette, white background`

    const payload: Record<string, unknown> = {
      prompt,
      steps: 20,
      guidance_scale: 5,
      width: 1024,
      height: 1024,
      seed: body.seed ?? Math.floor(Math.random() * 999999),
    }

    // Tenta usar a imagem de referência como ip_image
    if (body.reference_images?.length) {
      const img = body.reference_images[0] as string

      if (img.startsWith('http')) {
        payload.ip_image = img
      } else if (img.startsWith('data:')) {
        // Tenta upload para obter URL pública
        try {
          const uploadRes = await fetch('https://workflows-api.segmind.com/upload-asset', {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: img }),
          })
          if (uploadRes.ok) {
            const data = await uploadRes.json() as Record<string, string>
            const publicUrl = data.url ?? data.image_url ?? data.asset_url
            if (publicUrl) payload.ip_image = publicUrl
          }
        } catch {
          // Upload falhou — gera sem referência, prompt descritivo basta
          console.warn('[/api/generate-sheet] Upload falhou, gerando sem ip_image')
        }
      }
    }

    // ── Chamada ao Segmind ──
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
        return NextResponse.json({ error: 'Segmind não respondeu no tempo limite.' }, { status: 504 })
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }

    // Se deu erro de ip_image, tenta de novo sem ela
    if (!segmindRes.ok && payload.ip_image) {
      const errText = await segmindRes.text().catch(() => '')
      if (errText.toLowerCase().includes('ip') || errText.toLowerCase().includes('image')) {
        console.warn('[/api/generate-sheet] ip_image rejeitada, tentando sem referência')
        delete payload.ip_image

        const controller2 = new AbortController()
        const timeout2 = setTimeout(() => controller2.abort(), FETCH_TIMEOUT_MS)
        try {
          segmindRes = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller2.signal,
          })
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return NextResponse.json({ error: 'Segmind não respondeu no tempo limite.' }, { status: 504 })
          }
          throw err
        } finally {
          clearTimeout(timeout2)
        }
      }
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
