/**
 * Use Case: Clone Voice
 *
 * Clona uma voz a partir de áudio de referência.
 */

import type { VoiceProvider } from '@/domain/voice'
import { checkWalletBalance, spendCredits } from '@/lib/wallet'
import { getClientPrice } from '@/lib/pricing'

interface CloneVoiceInput {
  name: string
  audioBuffer: Buffer
  userId: string
  organizationId?: string
}

interface CloneVoiceOutput {
  voiceId: string
  cost: number
}

export async function cloneVoice(
  provider: VoiceProvider,
  input: CloneVoiceInput
): Promise<CloneVoiceOutput> {
  const clientPrice = await getClientPrice('elevenlabs-clone', 0.05)

  // Wallet check
  if (input.organizationId) {
    const wc = await checkWalletBalance(input.userId, input.organizationId, clientPrice)
    if (!wc.allowed) throw new Error(wc.reason ?? 'Saldo insuficiente')
  }

  const voiceId = await provider.cloneVoice(input.name, input.audioBuffer)

  // Wallet deduction
  if (input.organizationId) {
    const wc = await checkWalletBalance(input.userId, input.organizationId, 0)
    if (wc.walletId) {
      await spendCredits(wc.walletId, clientPrice, `Voice Clone · ${input.name}`, {
        generationType: 'voice', userId: input.userId,
      }).catch(() => {})
    }
  }

  return { voiceId, cost: clientPrice }
}
