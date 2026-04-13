import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createVoiceProvider } from '@/providers/elevenlabs'
import { searchVoices } from '@/usecases/voice/searchVoices'

export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    const { search } = await request.json()
    const provider = createVoiceProvider()
    const voices = await searchVoices(provider, search)
    return NextResponse.json({ voices })
  } catch (err) {
    console.error('[/api/voice/search]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro.' }, { status: 500 })
  }
}
