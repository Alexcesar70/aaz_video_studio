/**
 * POST /api/generate-voice
 * Proxy para ElevenLabs API — text-to-speech, voice design, voice clone.
 *
 * Body:
 *  - action: 'tts' | 'design' | 'clone' | 'list_voices'
 *
 * action='tts':
 *  - text: string
 *  - voiceId: string
 *  - modelId?: string (default: eleven_v3)
 *
 * action='design':
 *  - description: string (voice description prompt)
 *
 * action='clone':
 *  - name: string
 *  - audioUrl: string (URL do áudio de referência)
 *
 * action='list_voices':
 *  - search?: string (filtro por nome/descrição)
 */

import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getAuthUser } from '@/lib/auth'
import { emitEvent } from '@/lib/activity'
import { checkWalletBalance, spendCredits } from '@/lib/wallet'
import { getClientPrice, recordEngineCost } from '@/lib/pricing'

export const maxDuration = 60

const ELEVEN_BASE = 'https://api.elevenlabs.io/v1'

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'ELEVENLABS_API_KEY não configurada.' }, { status: 500 })

    const authUser = getAuthUser(request)
    if (!authUser) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const body = await request.json()
    const { action } = body

    // ── LIST VOICES (sem custo) ──
    if (action === 'list_voices') {
      const search = (body.search ?? '').toLowerCase()
      const res = await fetch(`${ELEVEN_BASE}/voices`, {
        headers: { 'xi-api-key': apiKey },
      })
      if (!res.ok) return NextResponse.json({ error: 'Erro ao buscar vozes.' }, { status: res.status })
      const data = await res.json()
      let voices = (data.voices ?? []).map((v: Record<string, unknown>) => ({
        id: v.voice_id,
        name: v.name,
        category: v.category,
        description: (v.labels as Record<string, string>)?.description ?? '',
        gender: (v.labels as Record<string, string>)?.gender ?? '',
        age: (v.labels as Record<string, string>)?.age ?? '',
        accent: (v.labels as Record<string, string>)?.accent ?? '',
        language: (v.labels as Record<string, string>)?.language ?? '',
        previewUrl: v.preview_url,
      }))
      if (search) {
        voices = voices.filter((v: Record<string, string>) =>
          v.name?.toLowerCase().includes(search) ||
          v.description?.toLowerCase().includes(search) ||
          v.gender?.toLowerCase().includes(search) ||
          v.accent?.toLowerCase().includes(search) ||
          v.language?.toLowerCase().includes(search)
        )
      }
      return NextResponse.json({ voices: voices.slice(0, 50) })
    }

    // ── TEXT TO SPEECH ──
    if (action === 'tts') {
      const { text, voiceId, modelId = 'eleven_v3' } = body
      if (!text?.trim() || !voiceId) return NextResponse.json({ error: 'text e voiceId obrigatórios.' }, { status: 400 })

      // Wallet check
      const charCount = text.length
      const costPer100 = await getClientPrice('elevenlabs-tts', 0.003)
      const estimatedCost = (charCount / 100) * costPer100
      let walletId: string | null = null
      if (authUser.organizationId) {
        const wc = await checkWalletBalance(authUser.id, authUser.organizationId, estimatedCost)
        walletId = wc.walletId
        if (!wc.allowed) return NextResponse.json({ error: wc.reason }, { status: 402 })
      }

      const res = await fetch(`${ELEVEN_BASE}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: modelId, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
      })
      if (!res.ok) {
        const err = await res.text().catch(() => '')
        return NextResponse.json({ error: `ElevenLabs: ${err.slice(0, 200)}` }, { status: res.status })
      }

      // Salva áudio no Blob
      const audioBuffer = await res.arrayBuffer()
      const filename = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.mp3`
      const blob = await put(filename, Buffer.from(audioBuffer), { access: 'public', contentType: 'audio/mpeg' })

      // Wallet deduction
      const realCost = (charCount / 100) * 0.003
      recordEngineCost('elevenlabs-tts', realCost).catch(() => {})
      if (walletId && estimatedCost > 0) {
        await spendCredits(walletId, estimatedCost, `Voz TTS · ${charCount} chars`, { generationType: 'voice', userId: authUser.id }).catch(() => {})
      }

      emitEvent({ userId: authUser.id, userName: authUser.name, userEmail: authUser.email, userRole: authUser.role, organizationId: authUser.organizationId, type: 'scene_generated', meta: { cost: estimatedCost, engineId: 'elevenlabs-tts', label: `TTS ${charCount} chars`, extra: { voiceAction: 'tts' } } }).catch(() => {})

      return NextResponse.json({ audioUrl: blob.url, characters: charCount, cost: estimatedCost })
    }

    // ── VOICE DESIGN (criar voz por descrição) ──
    if (action === 'design') {
      const { description } = body
      if (!description?.trim()) return NextResponse.json({ error: 'description obrigatório.' }, { status: 400 })

      // Wallet check (custo fixo por design)
      const designCost = await getClientPrice('elevenlabs-clone', 0.05)
      let walletId: string | null = null
      if (authUser.organizationId) {
        const wc = await checkWalletBalance(authUser.id, authUser.organizationId, designCost)
        walletId = wc.walletId
        if (!wc.allowed) return NextResponse.json({ error: wc.reason }, { status: 402 })
      }

      // Step 1: Design preview
      const designRes = await fetch(`${ELEVEN_BASE}/text-to-voice/create-previews`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_description: description, text: 'Olá! Eu sou um personagem do AAZ com Jesus. Vamos compartilhar e cuidar uns dos outros!' }),
      })

      if (!designRes.ok) {
        const err = await designRes.text().catch(() => '')
        return NextResponse.json({ error: `ElevenLabs design: ${err.slice(0, 200)}` }, { status: designRes.status })
      }

      const designData = await designRes.json()
      const previews = (designData.previews ?? []).map((p: Record<string, unknown>) => ({
        id: p.generated_voice_id,
        audioUrl: p.audio_base_64 ? `data:audio/mpeg;base64,${p.audio_base_64}` : '',
      }))

      // Wallet deduction
      if (walletId && designCost > 0) {
        await spendCredits(walletId, designCost, 'Voice Design (3 previews)', { generationType: 'voice', userId: authUser.id }).catch(() => {})
      }

      return NextResponse.json({ previews })
    }

    // ── SAVE DESIGNED VOICE ──
    if (action === 'save_voice') {
      const { voicePreviewId, name } = body
      if (!voicePreviewId || !name) return NextResponse.json({ error: 'voicePreviewId e name obrigatórios.' }, { status: 400 })

      const res = await fetch(`${ELEVEN_BASE}/text-to-voice/create-voice-from-preview`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_name: name, voice_description: body.description ?? '', generated_voice_id: voicePreviewId }),
      })
      if (!res.ok) {
        const err = await res.text().catch(() => '')
        return NextResponse.json({ error: `Erro ao salvar voz: ${err.slice(0, 200)}` }, { status: res.status })
      }
      const data = await res.json()
      return NextResponse.json({ voiceId: data.voice_id })
    }

    // ── CLONE VOICE ──
    if (action === 'clone') {
      const { name, audioUrl } = body
      if (!name || !audioUrl) return NextResponse.json({ error: 'name e audioUrl obrigatórios.' }, { status: 400 })

      const cloneCost = await getClientPrice('elevenlabs-clone', 0.05)
      let walletId: string | null = null
      if (authUser.organizationId) {
        const wc = await checkWalletBalance(authUser.id, authUser.organizationId, cloneCost)
        walletId = wc.walletId
        if (!wc.allowed) return NextResponse.json({ error: wc.reason }, { status: 402 })
      }

      // Download audio and create form data
      const audioRes = await fetch(audioUrl)
      const audioBlob = await audioRes.blob()

      const formData = new FormData()
      formData.append('name', name)
      formData.append('files', audioBlob, 'voice-sample.mp3')

      const res = await fetch(`${ELEVEN_BASE}/voices/add`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey },
        body: formData,
      })
      if (!res.ok) {
        const err = await res.text().catch(() => '')
        return NextResponse.json({ error: `Clone error: ${err.slice(0, 200)}` }, { status: res.status })
      }
      const data = await res.json()

      if (walletId && cloneCost > 0) {
        await spendCredits(walletId, cloneCost, `Voice Clone · ${name}`, { generationType: 'voice', userId: authUser.id }).catch(() => {})
      }

      return NextResponse.json({ voiceId: data.voice_id })
    }

    return NextResponse.json({ error: 'action inválida.' }, { status: 400 })
  } catch (err) {
    console.error('[/api/generate-voice]', err)
    return NextResponse.json({ error: 'Erro ao processar.' }, { status: 500 })
  }
}
