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

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Request body inválido ou muito grande. Reduza o número/tamanho das imagens.' }, { status: 413 })
    }

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

    // ── Chamada ao Segmind ──
    const endpoint = process.env.SEGMIND_VIDEO_ENDPOINT ?? 'https://api.segmind.com/v1/seedance-2.0'

    const payloadStr = JSON.stringify(segmindPayload)
    const payloadSizeMB = (payloadStr.length / 1024 / 1024).toFixed(2)
    console.log(`[/api/generate] Payload: ${payloadSizeMB}MB, mode: ${body.mode}, refs: ${body.reference_images?.length ?? 0}`)

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
        body: payloadStr,
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
      const errorText = await segmindRes.text().catch(() => '')
      let message = `Segmind retornou ${segmindRes.status}`
      try {
        const errorData = JSON.parse(errorText)
        message = errorData?.detail ?? errorData?.error ?? errorData?.message ?? message
      } catch {
        if (errorText) message = errorText.slice(0, 200)
      }
      console.error('[/api/generate] Segmind error:', segmindRes.status, message)
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
