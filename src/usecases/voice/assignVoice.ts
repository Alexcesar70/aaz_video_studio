/**
 * Use Case: Assign Voice to Character
 *
 * Salva (ou substitui) a voz de um personagem.
 * Pode vir de design, clone ou biblioteca.
 */

import type { CharacterVoice } from '@/domain/voice'
import { saveVoice, getVoice } from '@/repositories/voiceRepository'

interface AssignVoiceInput {
  characterId: string
  characterName: string
  voiceId: string
  voiceName: string
  provider: 'elevenlabs' | 'google' | 'azure' | 'custom'
  method: 'designed' | 'cloned' | 'library'
  description?: string
  previewUrl?: string
  userId: string
  organizationId?: string
}

export async function assignVoice(input: AssignVoiceInput): Promise<CharacterVoice> {
  const voice: CharacterVoice = {
    id: `voice_${input.characterId}_${Date.now()}`,
    characterId: input.characterId,
    characterName: input.characterName,
    voiceId: input.voiceId,
    voiceName: input.voiceName,
    provider: input.provider,
    method: input.method,
    description: input.description,
    previewUrl: input.previewUrl,
    createdAt: new Date().toISOString(),
    createdBy: input.userId,
    organizationId: input.organizationId,
  }

  await saveVoice(voice)
  return voice
}

export async function getCharacterVoice(orgId: string | undefined, characterId: string): Promise<CharacterVoice | null> {
  return getVoice(orgId, characterId)
}
