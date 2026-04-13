/**
 * Domain Entity: CharacterVoice
 *
 * Representa a voz atribuída a um personagem.
 * O núcleo do domínio — não depende de nenhuma camada externa.
 */

export interface CharacterVoice {
  id: string
  characterId: string
  characterName: string
  voiceId: string              // ID do provider (ex: ElevenLabs voice_id)
  voiceName: string
  provider: 'elevenlabs' | 'google' | 'azure' | 'custom'
  method: 'designed' | 'cloned' | 'library'
  description?: string         // descrição usada para criar a voz
  previewUrl?: string          // URL de amostra da voz
  createdAt: string
  createdBy: string
  organizationId?: string
}

export interface VoicePreview {
  id: string                   // generated_voice_id do provider
  audioUrl: string             // base64 ou URL
}

export interface SpeechResult {
  audioUrl: string
  characters: number
  durationSeconds?: number
}

export interface VoiceSearchResult {
  id: string
  name: string
  category?: string
  description?: string
  gender?: string
  age?: string
  accent?: string
  language?: string
  previewUrl?: string
}

/**
 * Interface do Voice Provider — abstração que desacopla
 * o domínio de qualquer implementação específica (ElevenLabs, etc).
 *
 * Qualquer provider novo implementa essa interface.
 * O domínio NUNCA importa o provider diretamente.
 */
export interface VoiceProvider {
  /** Gera áudio a partir de texto */
  textToSpeech(text: string, voiceId: string, modelId?: string): Promise<Buffer>

  /** Cria previews de voz a partir de descrição textual */
  designVoice(description: string, sampleText: string): Promise<VoicePreview[]>

  /** Salva uma voz desenhada como permanente */
  saveDesignedVoice(previewId: string, name: string, description?: string): Promise<string> // returns voiceId

  /** Clona uma voz a partir de áudio */
  cloneVoice(name: string, audioBuffer: Buffer): Promise<string> // returns voiceId

  /** Busca vozes na biblioteca do provider */
  searchVoices(query?: string): Promise<VoiceSearchResult[]>
}
