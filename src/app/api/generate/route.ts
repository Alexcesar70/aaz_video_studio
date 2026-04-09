import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/generate
 * Proxy server-side para Segmind Seedance 2.0
 * Resolve CORS — a SEGMIND_API_KEY nunca chega ao browser
 */

export const maxDuration = 120

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000
const FETCH_TIMEOUT_MS = 110_000 // 110s (Vercel limit = 120s)

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = MAX_RETRIES,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const res = await fetch(url, { ...init, signal: controller.signal })

      if (res.status === 429 && attempt < retries) {
        const retryAfter = res.headers.get('retry-after')
        const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : RETRY_DELAY_MS * (attempt + 1)
        console.warn(`[/api/generate] 429 rate-limited, retry ${attempt + 1}/${retries} in ${delay}ms`)
        await new Promise(r => setTimeout(r, delay))
        continue
      }

      return res
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (attempt < retries) {
          console.warn(`[/api/generate] timeout, retry ${attempt + 1}/${retries}`)
          continue
        }
        throw new Error('Segmind não respondeu no tempo limite (110s).')
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  throw new Error('Máximo de tentativas excedido.')
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

    // ── Chamada ao Segmind com retry ────────────────────────────
    const endpoint = process.env.SEGMIND_VIDEO_ENDPOINT ?? 'https://api.segmind.com/v1/seedance-2.0'

    const segmindRes = await fetchWithRetry(endpoint, {
      method:  'POST',
      headers: {
        'x-api-key':     apiKey,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(segmindPayload),
    })

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
