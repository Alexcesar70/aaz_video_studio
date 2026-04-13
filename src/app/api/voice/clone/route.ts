import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createVoiceProvider } from '@/providers/elevenlabs'
import { cloneVoice } from '@/usecases/voice/cloneVoice'

export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    const { name, audioUrl } = await request.json()
    if (!name || !audioUrl) return NextResponse.json({ error: 'name e audioUrl obrigatórios.' }, { status: 400 })
    // Download audio
    const audioRes = await fetch(audioUrl)
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer())
    const provider = createVoiceProvider()
    const result = await cloneVoice(provider, { name, audioBuffer, userId: authUser.id, organizationId: authUser.organizationId })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/voice/clone]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro.' }, { status: 500 })
  }
}
