import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getVoiceMap } from '@/repositories/voiceRepository'

export const dynamic = 'force-dynamic'

/** GET /api/voice/map — retorna mapa charId → voiceId da org */
export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    const map = await getVoiceMap(authUser.organizationId)
    return NextResponse.json({ map })
  } catch (err) {
    console.error('[/api/voice/map]', err)
    return NextResponse.json({ error: 'Erro.' }, { status: 500 })
  }
}
