/**
 * Use Case: Design Voice
 *
 * Gera previews de voz a partir de descrição textual.
 * Responsabilidade única: orquestrar provider + wallet + pricing.
 */

import type { VoiceProvider, VoicePreview } from '@/domain/voice'
import { checkWalletBalance, spendCredits } from '@/lib/wallet'
import { getClientPrice } from '@/lib/pricing'

interface DesignVoiceInput {
  description: string
  sampleText?: string
  userId: string
  organizationId?: string
  previewCount?: number
}

interface DesignVoiceOutput {
  previews: VoicePreview[]
  cost: number
}

export async function designVoice(
  provider: VoiceProvider,
  input: DesignVoiceInput
): Promise<DesignVoiceOutput> {
  const count = input.previewCount ?? 3
  const clientPrice = await getClientPrice('elevenlabs-clone', 0.05)

  // Wallet check
  if (input.organizationId) {
    const wc = await checkWalletBalance(input.userId, input.organizationId, clientPrice)
    if (!wc.allowed) throw new Error(wc.reason ?? 'Saldo insuficiente')
  }

  const sampleText = input.sampleText ?? 'Olá! Eu sou um personagem especial. Vamos compartilhar e cuidar uns dos outros!'

  // Gera previews
  const previews: VoicePreview[] = []
  for (let i = 0; i < count; i++) {
    try {
      const preview = await provider.designVoice(input.description, sampleText)
      if (preview.id) previews.push(preview)
    } catch (err) {
      console.error(`[designVoice] Preview ${i + 1} failed:`, err)
      if (i === 0) throw err // se o primeiro falha, propaga
    }
  }

  // Wallet deduction
  if (input.organizationId) {
    const wc = await checkWalletBalance(input.userId, input.organizationId, 0)
    if (wc.walletId) {
      await spendCredits(wc.walletId, clientPrice, `Voice Design (${previews.length} previews)`, {
        generationType: 'voice', userId: input.userId,
      }).catch(() => {})
    }
  }

  return { previews, cost: clientPrice }
}
