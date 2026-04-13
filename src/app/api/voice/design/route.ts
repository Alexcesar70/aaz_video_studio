import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createVoiceProvider } from '@/providers/elevenlabs'
import { designVoice } from '@/usecases/voice/designVoice'

export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    const { description, sampleText } = await request.json()
    if (!description?.trim()) return NextResponse.json({ error: 'description obrigatório.' }, { status: 400 })
    const provider = createVoiceProvider()
    const result = await designVoice(provider, { description, sampleText, userId: authUser.id, organizationId: authUser.organizationId })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/voice/design]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro.' }, { status: 500 })
  }
}
