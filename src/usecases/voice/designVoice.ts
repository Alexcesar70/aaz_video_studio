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
}

interface DesignVoiceOutput {
  previews: VoicePreview[]
  cost: number
}

export async function designVoice(
  provider: VoiceProvider,
  input: DesignVoiceInput
): Promise<DesignVoiceOutput> {
  const clientPrice = await getClientPrice('elevenlabs-clone', 0.05)

  // Wallet check
  if (input.organizationId) {
    const wc = await checkWalletBalance(input.userId, input.organizationId, clientPrice)
    if (!wc.allowed) throw new Error(wc.reason ?? 'Saldo insuficiente')
  }

  const sampleText = input.sampleText ?? 'Olá! Eu sou um personagem muito especial e estou aqui para contar histórias incríveis. Vamos compartilhar, cuidar uns dos outros e viver grandes aventuras juntos!'

  // Gera previews — uma chamada retorna múltiplos
  const previews = await provider.designVoice(input.description, sampleText)
  console.log(`[designVoice] Got ${previews.length} previews`)

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
