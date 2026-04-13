/**
 * Use Case: Generate Speech (Text-to-Speech)
 *
 * Converte texto em áudio usando a voz de um personagem.
 */

import type { VoiceProvider, SpeechResult } from '@/domain/voice'
import { put } from '@vercel/blob'
import { checkWalletBalance, spendCredits } from '@/lib/wallet'
import { getClientPrice, recordEngineCost } from '@/lib/pricing'

interface GenerateSpeechInput {
  text: string
  voiceId: string
  modelId?: string
  userId: string
  organizationId?: string
}

export async function generateSpeech(
  provider: VoiceProvider,
  input: GenerateSpeechInput
): Promise<SpeechResult> {
  const charCount = input.text.length
  const costPer100 = await getClientPrice('elevenlabs-tts', 0.003)
  const estimatedCost = (charCount / 100) * costPer100

  // Wallet check
  if (input.organizationId) {
    const wc = await checkWalletBalance(input.userId, input.organizationId, estimatedCost)
    if (!wc.allowed) throw new Error(wc.reason ?? 'Saldo insuficiente')
  }

  // Gera áudio
  const audioBuffer = await provider.textToSpeech(input.text, input.voiceId, input.modelId)

  // Salva no Blob
  const filename = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.mp3`
  const blob = await put(filename, audioBuffer, { access: 'public', contentType: 'audio/mpeg' })

  // Registra custo real + wallet deduction
  const realCost = (charCount / 100) * 0.003
  recordEngineCost('elevenlabs-tts', realCost).catch(() => {})

  if (input.organizationId) {
    const wc = await checkWalletBalance(input.userId, input.organizationId, 0)
    if (wc.walletId) {
      await spendCredits(wc.walletId, estimatedCost, `Voz TTS · ${charCount} chars`, {
        generationType: 'voice', userId: input.userId,
      }).catch(() => {})
    }
  }

  return { audioUrl: blob.url, characters: charCount }
}
