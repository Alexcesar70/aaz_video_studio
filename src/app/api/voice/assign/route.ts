import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { assignVoice } from '@/usecases/voice/assignVoice'
import { createVoiceProvider } from '@/providers/elevenlabs'

export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    const body = await request.json()
    const { characterId, characterName, voiceId, voiceName, method, description, previewId } = body

    // Se previewId, salva a voz desenhada primeiro
    let finalVoiceId = voiceId
    if (previewId && !voiceId) {
      const provider = createVoiceProvider()
      finalVoiceId = await provider.saveDesignedVoice(previewId, characterName ?? characterId, description)
    }

    if (!characterId || !finalVoiceId) return NextResponse.json({ error: 'characterId e voiceId obrigatórios.' }, { status: 400 })

    const voice = await assignVoice({
      characterId,
      characterName: characterName ?? characterId,
      voiceId: finalVoiceId,
      voiceName: voiceName ?? characterName ?? '',
      provider: 'elevenlabs',
      method: method ?? 'library',
      description,
      userId: authUser.id,
      organizationId: authUser.organizationId,
    })
    return NextResponse.json({ voice })
  } catch (err) {
    console.error('[/api/voice/assign]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro.' }, { status: 500 })
  }
}
