import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createVoiceProvider } from '@/providers/elevenlabs'
import { generateSpeech } from '@/usecases/voice/generateSpeech'

export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    const { text, voiceId, modelId } = await request.json()
    if (!text?.trim() || !voiceId) return NextResponse.json({ error: 'text e voiceId obrigatórios.' }, { status: 400 })
    const provider = createVoiceProvider()
    const result = await generateSpeech(provider, { text, voiceId, modelId, userId: authUser.id, organizationId: authUser.organizationId })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/voice/tts]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro.' }, { status: 500 })
  }
}
