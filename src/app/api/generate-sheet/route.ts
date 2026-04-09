import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/generate-sheet
 * Proxy server-side para Segmind Seedance 2.0 Character Sheet
 * Resolve CORS — a SEGMIND_API_KEY nunca chega ao browser
 */

export const maxDuration = 120

const FETCH_TIMEOUT_MS = 110_000 // 110s (Vercel limit = 120s)

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

    if (!body.reference_images?.length) {
      return NextResponse.json({ error: 'reference_images é obrigatório.' }, { status: 400 })
    }
    if (!body.character_name?.trim()) {
      return NextResponse.json({ error: 'character_name é obrigatório.' }, { status: 400 })
    }

    // ── Chamada ao Segmind (sem retry para evitar cobrança dupla) ──
    const endpoint = process.env.SEGMIND_SHEET_ENDPOINT
      ?? 'https://api.segmind.com/v1/seedance-2.0-character'

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    let segmindRes: Response
    try {
      segmindRes = await fetch(endpoint, {
        method:  'POST',
        headers: {
          'x-api-key':    apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reference_images: body.reference_images,
          character_name:   body.character_name,
        }),
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
        'Content-Type':        'image/png',
        'Content-Disposition': `inline; filename="sheet-${body.character_id ?? 'char'}.png"`,
        'Cache-Control':       'no-store',
      },
    })

  } catch (err) {
    console.error('[/api/generate-sheet]', err)
    const message = err instanceof Error ? err.message : 'Erro interno ao processar a requisição.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
