/**
 * Use Case: Search Voices
 *
 * Busca vozes na biblioteca do provider.
 * Sem custo (não consome créditos).
 */

import type { VoiceProvider, VoiceSearchResult } from '@/domain/voice'

export async function searchVoices(
  provider: VoiceProvider,
  query?: string
): Promise<VoiceSearchResult[]> {
  return provider.searchVoices(query)
}
