import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createVoiceProvider } from '@/providers/elevenlabs'
import { designVoice } from '@/usecases/voice/designVoice'

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY não configurada. Adicione nas variáveis de ambiente da Vercel.' }, { status: 500 })
    }
    const authUser = getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    const body = await request.json()
    const { description, sampleText } = body
    console.log('[/api/voice/design] Request:', { description: description?.slice(0, 100), sampleText: sampleText?.slice(0, 50), userId: authUser.id })
    if (!description?.trim()) return NextResponse.json({ error: 'description obrigatório.' }, { status: 400 })
    const provider = createVoiceProvider()
    const result = await designVoice(provider, { description, sampleText, userId: authUser.id, organizationId: authUser.organizationId })
    console.log('[/api/voice/design] Success:', { previews: result.previews.length })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[/api/voice/design] Error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao gerar previews.' }, { status: 500 })
  }
}
