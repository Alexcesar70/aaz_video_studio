/**
 * Voice Repository — persistência de vozes no Redis.
 *
 * Redis keys:
 *  - aaz:voice:{orgId}:{characterId} → CharacterVoice JSON
 *  - aaz:voices:{orgId}              → Set de characterIds com voz
 */

import { getRedis } from '@/lib/redis'
import type { CharacterVoice } from '@/domain/voice'

const VOICE_PREFIX = 'aaz:voice:'
const VOICES_SET_PREFIX = 'aaz:voices:'

function voiceKey(orgId: string | undefined, characterId: string): string {
  return `${VOICE_PREFIX}${orgId ?? 'global'}:${characterId}`
}

function voicesSetKey(orgId: string | undefined): string {
  return `${VOICES_SET_PREFIX}${orgId ?? 'global'}`
}

export async function saveVoice(voice: CharacterVoice): Promise<void> {
  const redis = await getRedis()
  await redis.set(voiceKey(voice.organizationId, voice.characterId), JSON.stringify(voice))
  await redis.sAdd(voicesSetKey(voice.organizationId), voice.characterId)
}

export async function getVoice(orgId: string | undefined, characterId: string): Promise<CharacterVoice | null> {
  const redis = await getRedis()
  const val = await redis.get(voiceKey(orgId, characterId))
  if (!val) return null
  try { return JSON.parse(val) as CharacterVoice } catch { return null }
}

export async function getVoicesByOrg(orgId: string | undefined): Promise<CharacterVoice[]> {
  const redis = await getRedis()
  const charIds = await redis.sMembers(voicesSetKey(orgId))
  const voices: CharacterVoice[] = []
  for (const charId of charIds) {
    const voice = await getVoice(orgId, charId)
    if (voice) voices.push(voice)
  }
  return voices
}

export async function deleteVoice(orgId: string | undefined, characterId: string): Promise<void> {
  const redis = await getRedis()
  await redis.del(voiceKey(orgId, characterId))
  await redis.sRem(voicesSetKey(orgId), characterId)
}

export async function getVoiceMap(orgId: string | undefined): Promise<Record<string, { voiceId: string; voiceName: string }>> {
  const voices = await getVoicesByOrg(orgId)
  const map: Record<string, { voiceId: string; voiceName: string }> = {}
  for (const v of voices) {
    map[v.characterId] = { voiceId: v.voiceId, voiceName: v.voiceName }
  }
  return map
}
