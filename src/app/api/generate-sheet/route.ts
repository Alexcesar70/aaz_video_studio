import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/generate-sheet
 * Proxy server-side para Segmind Seedance 2.0 Character Sheet
 * Resolve CORS — a SEGMIND_API_KEY nunca chega ao browser
 *
 * Body esperado:
 * {
 *   reference_images: string[]   // base64 data URLs (1–3 fotos)
 *   character_name: string       // ex: "Abigail"
 *   character_id: string         // ex: "abigail" (para salvar no KV na Fase 3)
 * }
 *
 * Resposta: image/png blob (pass-through do Segmind)
 *
 * TODO Fase 2 (Alexandre):
 *  - Confirmar schema exato do endpoint seedance-2.0-character
 *  - Adicionar retry automático (o endpoint pode demorar até 60s)
 *  - TODO Fase 3 (Alexandre): após gerar, salvar no Vercel KV
 *    kv.set(`aaz:char:${character_id}`, { sheetUrl, name, emoji, ... })
 */

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

    const endpoint = process.env.SEGMIND_SHEET_ENDPOINT
      ?? 'https://api.segmind.com/v1/seedance-2.0-character'

    const segmindRes = await fetch(endpoint, {
      method:  'POST',
      headers: {
        'x-api-key':    apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reference_images: body.reference_images,
        character_name:   body.character_name,
      }),
    })

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
    return NextResponse.json(
      { error: 'Erro interno ao processar a requisição.' },
      { status: 500 }
    )
  }
}
