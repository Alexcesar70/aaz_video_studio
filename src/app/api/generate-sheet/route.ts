import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

/**
 * POST /api/generate-sheet
 * Proxy server-side para Segmind Consistent Character AI Neolemon V3
 * Gera character sheet multi-pose a partir de prompt + imagem de referência
 *
 * A imagem de referência (base64) é primeiro enviada ao Vercel Blob para
 * obter uma URL pública, que o Neolemon V3 aceita no campo ip_image.
 */

export const maxDuration = 300

const FETCH_TIMEOUT_MS = 290_000

const ENDPOINT = 'https://api.segmind.com/v1/consistent-character-AI-neolemon-v3'

async function base64ToPublicUrl(base64DataUrl: string): Promise<string> {
  // Extrai o content type e o base64 puro
  const matches = base64DataUrl.match(/^data:(.+);base64,(.+)$/)
  if (!matches) throw new Error('Formato base64 inválido')

  const contentType = matches[1]
  const ext = contentType.split('/')[1] || 'png'
  const buffer = Buffer.from(matches[2], 'base64')

  const blob = await put(`ref-${Date.now()}.${ext}`, buffer, {
    access: 'public',
    contentType,
  })

  return blob.url
}

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

    // Exige pelo menos uma imagem de referência
    if (!body.reference_images?.length) {
      return NextResponse.json({ error: 'Suba ao menos uma foto de referência.' }, { status: 400 })
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

    // Converte referência para URL pública via Vercel Blob
    const img = body.reference_images[0] as string
    if (img.startsWith('http')) {
      payload.ip_image = img
    } else if (img.startsWith('data:')) {
      try {
        const publicUrl = await base64ToPublicUrl(img)
        payload.ip_image = publicUrl
      } catch (err) {
        console.error('[/api/generate-sheet] Upload Blob falhou:', err)
        return NextResponse.json(
          { error: 'Falha ao fazer upload da imagem. Verifique se o Vercel Blob está configurado.' },
          { status: 500 }
        )
      }
    }

    if (!payload.ip_image) {
      return NextResponse.json({ error: 'Não foi possível processar a imagem de referência.' }, { status: 400 })
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
