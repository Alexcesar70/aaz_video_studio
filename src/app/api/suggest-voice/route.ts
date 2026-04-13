/**
 * POST /api/suggest-voice
 * Claude analisa a descrição do personagem e sugere uma descrição
 * de voz otimizada para o ElevenLabs Voice Design.
 *
 * Body:
 *  - characterName: string
 *  - characterDescription: string (visual + personalidade)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { checkWalletBalance, spendCredits } from '@/lib/wallet'
import { getClientPrice } from '@/lib/pricing'

export async function POST(request: NextRequest) {
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 })

    const authUser = getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const body = await request.json()
    const { characterName, characterDescription } = body
    if (!characterDescription?.trim()) return NextResponse.json({ error: 'characterDescription obrigatório.' }, { status: 400 })

    // Wallet check
    const clientPrice = await getClientPrice('scene-director', 0.015)
    let walletId: string | null = null
    if (authUser.organizationId) {
      const wc = await checkWalletBalance(authUser.id, authUser.organizationId, clientPrice)
      walletId = wc.walletId
      if (!wc.allowed) return NextResponse.json({ error: wc.reason }, { status: 402 })
    }

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        system: `You are a voice casting director. Given a character's visual description and personality, create a voice description optimized for ElevenLabs Voice Design API.

Output format: A single paragraph in English describing the voice. Include:
- Age and gender
- Tone (warm, bright, deep, soft, energetic)
- Accent (Brazilian Portuguese from São Paulo, unless specified)
- Pacing (fast, slow, natural)
- Personality reflected in voice (shy = quieter, brave = confident)
- Audio quality note: "Perfect audio quality."

Example: "Perfect audio quality. Young Brazilian boy, 8 years old, warm and enthusiastic tone, slightly high-pitched voice, natural Brazilian Portuguese accent from São Paulo, cheerful and brave personality, speaks with energy and confidence."

Return ONLY the voice description, nothing else.`,
        messages: [{ role: 'user', content: `Character: ${characterName}\nDescription: ${characterDescription}` }],
      }),
    })

    if (!res.ok) return NextResponse.json({ error: `Claude: ${res.status}` }, { status: res.status })
    const data = await res.json()
    const suggestion = data.content?.[0]?.text ?? ''

    // Wallet deduction
    if (walletId && clientPrice > 0) {
      await spendCredits(walletId, clientPrice, `Voice suggestion · ${characterName}`, { generationType: 'voice', userId: authUser.id }).catch(() => {})
    }

    return NextResponse.json({ suggestion })
  } catch (err) {
    console.error('[/api/suggest-voice]', err)
    return NextResponse.json({ error: 'Erro.' }, { status: 500 })
  }
}
