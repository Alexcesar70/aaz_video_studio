/**
 * ElevenLabs Provider — implementação concreta da interface VoiceProvider.
 *
 * Esta é a ÚNICA camada que conhece a API do ElevenLabs.
 * Se trocar de provider, cria outro arquivo implementando VoiceProvider.
 */

import type { VoiceProvider, VoicePreview, VoiceSearchResult } from '@/domain/voice'

const BASE_URL = 'https://api.elevenlabs.io/v1'

export class ElevenLabsProvider implements VoiceProvider {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private headers(contentType = 'application/json'): Record<string, string> {
    return {
      'xi-api-key': this.apiKey,
      'Content-Type': contentType,
    }
  }

  async textToSpeech(text: string, voiceId: string, modelId = 'eleven_v3'): Promise<Buffer> {
    const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`ElevenLabs TTS error ${res.status}: ${err.slice(0, 200)}`)
    }
    return Buffer.from(await res.arrayBuffer())
  }

  async designVoice(description: string, sampleText: string): Promise<VoicePreview> {
    // ElevenLabs exige mínimo 100 caracteres no sample text
    let text = sampleText
    if (text.length < 100) {
      text = text + ' ' + 'Cada dia é uma nova aventura cheia de descobertas e aprendizados maravilhosos para compartilhar com todos os amigos.'
    }
    console.log(`[ElevenLabs] designVoice: desc=${description.slice(0, 80)}... text=${text.length} chars`)
    const res = await fetch(`${BASE_URL}/text-to-voice/design`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        voice_description: description,
        text,
      }),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`ElevenLabs Design error ${res.status}: ${err.slice(0, 200)}`)
    }
    const data = await res.json()
    return {
      id: data.generated_voice_id ?? '',
      audioUrl: data.audio_base_64 ? `data:audio/mpeg;base64,${data.audio_base_64}` : '',
    }
  }

  async saveDesignedVoice(previewId: string, name: string, description?: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/text-to-voice`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        voice_name: name,
        voice_description: description ?? '',
        generated_voice_id: previewId,
      }),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`ElevenLabs SaveVoice error ${res.status}: ${err.slice(0, 200)}`)
    }
    const data = await res.json()
    return data.voice_id
  }

  async cloneVoice(name: string, audioBuffer: Buffer): Promise<string> {
    const formData = new FormData()
    formData.append('name', name)
    formData.append('files', new Blob([new Uint8Array(audioBuffer)], { type: 'audio/mpeg' }), 'voice-sample.mp3')

    const res = await fetch(`${BASE_URL}/voices/add`, {
      method: 'POST',
      headers: { 'xi-api-key': this.apiKey },
      body: formData,
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`ElevenLabs Clone error ${res.status}: ${err.slice(0, 200)}`)
    }
    const data = await res.json()
    return data.voice_id
  }

  async searchVoices(query?: string): Promise<VoiceSearchResult[]> {
    const res = await fetch(`${BASE_URL}/voices`, {
      headers: { 'xi-api-key': this.apiKey },
    })
    if (!res.ok) throw new Error(`ElevenLabs Voices error ${res.status}`)
    const data = await res.json()

    const q = (query ?? '').toLowerCase()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let voices = (data.voices ?? []).map((v: any) => ({
      id: v.voice_id,
      name: v.name,
      category: v.category,
      description: v.labels?.description ?? '',
      gender: v.labels?.gender ?? '',
      age: v.labels?.age ?? '',
      accent: v.labels?.accent ?? '',
      language: v.labels?.language ?? '',
      previewUrl: v.preview_url,
    }))

    if (q) {
      voices = voices.filter((v: VoiceSearchResult) =>
        v.name?.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q) ||
        v.gender?.toLowerCase().includes(q) ||
        v.accent?.toLowerCase().includes(q) ||
        v.language?.toLowerCase().includes(q)
      )
    }
    return voices.slice(0, 50)
  }
}

/** Factory: cria a instância do provider configurada */
export function createVoiceProvider(): VoiceProvider {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY não configurada')
  return new ElevenLabsProvider(apiKey)
}
