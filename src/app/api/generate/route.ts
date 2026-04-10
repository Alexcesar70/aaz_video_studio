import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/generate
 * Proxy server-side para Segmind Seedance 2.0
 * Resolve CORS — a SEGMIND_API_KEY nunca chega ao browser
 */

export const maxDuration = 300

const FETCH_TIMEOUT_MS = 290_000

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

    // Validação mínima
    if (!body.prompt?.trim()) {
      return NextResponse.json({ error: 'prompt é obrigatório.' }, { status: 400 })
    }
    if (!body.duration || !body.aspect_ratio) {
      return NextResponse.json({ error: 'duration e aspect_ratio são obrigatórios.' }, { status: 400 })
    }

    // ── Monta o payload para o Segmind ──────────────────────────
    const segmindPayload: Record<string, unknown> = {
      prompt:          body.prompt,
      duration:        body.duration,
      aspect_ratio:    body.aspect_ratio,
      resolution:      body.resolution ?? '720p',
      generate_audio:  body.generate_audio ?? false,
    }

    // Omni Reference — injeta imagens/vídeos/áudios
    if (body.mode === 'omni_reference') {
      if (body.reference_images?.length)  segmindPayload.reference_images  = body.reference_images
      if (body.reference_videos?.length)  segmindPayload.reference_videos  = body.reference_videos
      if (body.reference_audios?.length)  segmindPayload.reference_audios  = body.reference_audios
    }

    // First/Last frames
    if (body.first_frame_url) segmindPayload.first_frame_url = body.first_frame_url
    if (body.last_frame_url)  segmindPayload.last_frame_url  = body.last_frame_url

    // ── Chamada ao Segmind (sem retry para evitar cobrança dupla) ──
    const endpoint = process.env.SEGMIND_VIDEO_ENDPOINT ?? 'https://api.segmind.com/v1/seedance-2.0'

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    let segmindRes: Response
    try {
      segmindRes = await fetch(endpoint, {
        method:  'POST',
        headers: {
          'x-api-key':     apiKey,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(segmindPayload),
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

    // Pass-through do blob de vídeo
    const videoBlob = await segmindRes.arrayBuffer()

    return new NextResponse(videoBlob, {
      status: 200,
      headers: {
        'Content-Type':        'video/mp4',
        'Content-Disposition': 'inline; filename="aaz-scene.mp4"',
        'Cache-Control':       'no-store',
      },
    })

  } catch (err) {
    console.error('[/api/generate]', err)
    const message = err instanceof Error ? err.message : 'Erro interno ao processar a requisição.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
