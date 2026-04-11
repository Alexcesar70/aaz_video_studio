/**
 * Registro de engines de vídeo disponíveis no Segmind.
 * Cada engine descreve endpoint, preço e features suportadas.
 * O /api/generate usa essa lista para rotear a chamada via adapter.
 *
 * Preços são ESTIMATIVAS baseadas no Segmind. O valor real cobrado
 * pode variar — a UI deve mostrar "preço estimado" ao usuário.
 */

export type EngineFeatures = {
  /** Omni Reference — múltiplas imagens de referência com tags @image */
  omniReference: boolean
  /** Suporta primeira/última frame (first/last) */
  firstLastFrames: boolean
  /** Suporta geração de áudio no mesmo pipeline */
  audio: boolean
  /** Número máximo de imagens de referência aceitas */
  maxRefImages: number
  /** Suporta reference_videos */
  referenceVideos: boolean
  /** Suporta reference_audios */
  referenceAudios: boolean
}

export type VideoEngine = {
  id: string
  name: string
  tier: 'standard' | 'fast' | 'premium'
  endpoint: string
  pricePerSecond: number
  /** Durações suportadas em segundos. Vazio = aceita qualquer da lista global. */
  durations: number[]
  /** Aspect ratios suportados. Vazio = aceita qualquer. */
  aspectRatios: string[]
  resolutions: string[]
  defaultResolution: string
  features: EngineFeatures
  /** Descrição curta para o usuário */
  description: string
}

export const VIDEO_ENGINES: VideoEngine[] = [
  {
    id: 'seedance-2.0',
    name: 'Seedance 2.0',
    tier: 'standard',
    endpoint: 'https://api.segmind.com/v1/seedance-2.0',
    pricePerSecond: 0.19,
    durations: [4, 5, 8, 10, 12, 15],
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
    resolutions: ['480p', '720p', '1080p'],
    defaultResolution: '720p',
    features: {
      omniReference: true,
      firstLastFrames: true,
      audio: true,
      maxRefImages: 9,
      referenceVideos: true,
      referenceAudios: true,
    },
    description: 'Padrão — Omni Reference (9 refs), áudio, first/last frame',
  },
  {
    id: 'seedance-2.0-fast',
    name: 'Seedance 2.0 Fast',
    tier: 'fast',
    endpoint: 'https://api.segmind.com/v1/seedance-2.0-fast',
    pricePerSecond: 0.10,
    durations: [4, 5, 8, 10],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['480p', '720p'],
    defaultResolution: '720p',
    features: {
      omniReference: true,
      firstLastFrames: true,
      audio: true,
      maxRefImages: 9,
      referenceVideos: false,
      referenceAudios: false,
    },
    description: 'Mesmo estilo, mais rápido e mais barato',
  },
  {
    id: 'wan-2.7-r2v',
    name: 'Wan 2.7 R2V',
    tier: 'standard',
    endpoint: 'https://api.segmind.com/v1/wan-2.7-r2v',
    pricePerSecond: 0.12,
    durations: [4, 5, 8],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['480p', '720p'],
    defaultResolution: '720p',
    features: {
      omniReference: true,
      firstLastFrames: false,
      audio: false,
      maxRefImages: 4,
      referenceVideos: false,
      referenceAudios: false,
    },
    description: 'Reference-to-video: até 4 imagens, bom para consistência',
  },
  {
    id: 'kling-2.5-turbo',
    name: 'Kling 2.5 Turbo',
    tier: 'premium',
    endpoint: 'https://api.segmind.com/v1/kling-2.5-turbo',
    pricePerSecond: 0.35,
    durations: [5, 10],
    aspectRatios: ['16:9', '9:16', '1:1'],
    resolutions: ['720p', '1080p'],
    defaultResolution: '1080p',
    features: {
      omniReference: false,
      firstLastFrames: true,
      audio: false,
      maxRefImages: 1,
      referenceVideos: false,
      referenceAudios: false,
    },
    description: 'Alta qualidade cinematográfica, 1 imagem de referência',
  },
  {
    id: 'veo-3.1-lite',
    name: 'Veo 3.1 Lite',
    tier: 'premium',
    endpoint: 'https://api.segmind.com/v1/veo-3.1-lite',
    pricePerSecond: 0.30,
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p'],
    defaultResolution: '720p',
    features: {
      omniReference: false,
      firstLastFrames: true,
      audio: true,
      maxRefImages: 1,
      referenceVideos: false,
      referenceAudios: false,
    },
    description: 'Google Veo 3.1 — áudio nativo, alta fidelidade',
  },
  {
    id: 'veo-3.1',
    name: 'Veo 3.1',
    tier: 'premium',
    endpoint: 'https://api.segmind.com/v1/veo-3.1',
    pricePerSecond: 0.50,
    durations: [4, 6, 8],
    aspectRatios: ['16:9', '9:16'],
    resolutions: ['720p', '1080p'],
    defaultResolution: '1080p',
    features: {
      omniReference: false,
      firstLastFrames: true,
      audio: true,
      maxRefImages: 1,
      referenceVideos: false,
      referenceAudios: false,
    },
    description: 'Veo 3.1 full — máxima qualidade, áudio nativo',
  },
]

export const DEFAULT_ENGINE_ID = 'seedance-2.0'

export function getEngine(id: string): VideoEngine {
  return VIDEO_ENGINES.find(e => e.id === id) ?? VIDEO_ENGINES[0]
}

/**
 * Body comum vindo do cliente. O adapter transforma no formato
 * específico de cada engine.
 */
export type CommonVideoBody = {
  prompt: string
  duration: number
  aspect_ratio: string
  resolution?: string
  generate_audio?: boolean
  mode?: 'text_to_video' | 'first_last_frames' | 'omni_reference'
  reference_images?: string[]
  reference_videos?: string[]
  reference_audios?: string[]
  first_frame_url?: string
  last_frame_url?: string
}

/**
 * Transforma o body comum no payload específico da engine.
 * Cada engine tem um schema ligeiramente diferente — esse adapter
 * centraliza as diferenças.
 */
export function buildEnginePayload(
  engine: VideoEngine,
  body: CommonVideoBody
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    prompt: body.prompt,
    duration: body.duration,
    aspect_ratio: body.aspect_ratio,
    resolution: body.resolution ?? engine.defaultResolution,
  }

  // Áudio — só adiciona quando a engine suporta
  if (engine.features.audio) {
    base.generate_audio = body.generate_audio ?? false
  }

  // Omni Reference — imagens/vídeos/áudios
  if (body.mode === 'omni_reference') {
    if (engine.features.omniReference && body.reference_images?.length) {
      const capped = body.reference_images.slice(0, engine.features.maxRefImages)
      base.reference_images = capped
    } else if (!engine.features.omniReference && body.reference_images?.length) {
      // Engine não suporta múltiplas refs — usa só a primeira como image_url
      base.image_url = body.reference_images[0]
    }
    if (engine.features.referenceVideos && body.reference_videos?.length) {
      base.reference_videos = body.reference_videos
    }
    if (engine.features.referenceAudios && body.reference_audios?.length) {
      base.reference_audios = body.reference_audios
    }
  }

  // First/Last frames
  if (engine.features.firstLastFrames) {
    if (body.first_frame_url) base.first_frame_url = body.first_frame_url
    if (body.last_frame_url) base.last_frame_url = body.last_frame_url
  }

  return base
}
