import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/webhooks/suno
 * Callback endpoint para o Suno API notificar quando a música ficou pronta.
 * Por enquanto apenas loga — usamos polling no /api/generate-music.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('[webhooks/suno] Callback received:', JSON.stringify(body).slice(0, 500))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
