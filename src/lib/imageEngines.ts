/**
 * Registro de motores de geração de imagem (Segmind).
 *
 * IMPORTANTE sobre schemas: o Segmind expõe cada modelo com um schema
 * ligeiramente diferente. Esse arquivo usa uma abstração comum
 * (CommonImageBody) que o adapter `buildImagePayload` transforma no
 * payload específico de cada motor. Se algum endpoint estiver com o
 * schema errado quando testar em produção, corrige o adapter deste
 * arquivo — o resto do app não precisa mudar.
 *
 * Todos os preços são ESTIMATIVAS. A UI marca como "preço estimado".
 */

export type ImageEngineFeatures = {
  /** Aceita negative_prompt */
  negativePrompt: boolean
  /** Aceita imagem de referência (img2img, edit, ou control) */
  referenceImage: boolean
  /** Gera várias imagens numa chamada só (vs N chamadas) */
  batchOutputs: boolean
  /** Máximo de imagens que a engine entrega em uma chamada (se batch) */
  maxBatchSize: number
  /** Aceita seed pra reproduzir */
  seed: boolean
  /** Aceita strength/denoise pra controle de ref */
  refStrength: boolean
}

export type ImageEngine = {
  id: string
  name: string
  tier: 'fast' | 'standard' | 'premium'
  endpoint: string
  pricePerImage: number
  aspectRatios: string[]
  defaultAspectRatio: string
  features: ImageEngineFeatures
  description: string
}

/**
 * 5 motores principais. Nano Banana Pro é o default.
 * Os endpoints podem ser sobrescritos via env var:
 *   SEGMIND_NANO_BANANA_PRO_ENDPOINT
 *   SEGMIND_NANO_BANANA_2_ENDPOINT
 *   SEGMIND_FLUX_DEV_ENDPOINT
 *   SEGMIND_IDEOGRAM_V2_ENDPOINT
 *   SEGMIND_IMAGEN_3_ENDPOINT
 */
export const IMAGE_ENGINES: ImageEngine[] = [
  {
    id: 'nano-banana-pro',
    name: 'Nano Banana Pro',
    tier: 'premium',
    endpoint:
      process.env.SEGMIND_NANO_BANANA_PRO_ENDPOINT ??
      'https://api.segmind.com/v1/nano-banana-pro',
    pricePerImage: 0.04,
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    defaultAspectRatio: '1:1',
    features: {
      negativePrompt: false,
      referenceImage: true,
      batchOutputs: false,
      maxBatchSize: 1,
      seed: true,
      refStrength: false,
    },
    description: 'Default — Google Gemini Image, top consistência de personagem',
  },
  {
    id: 'nano-banana-2',
    name: 'Nano Banana 2',
    tier: 'standard',
    endpoint:
      process.env.SEGMIND_NANO_BANANA_2_ENDPOINT ??
      'https://api.segmind.com/v1/nano-banana-2',
    pricePerImage: 0.02,
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    defaultAspectRatio: '1:1',
    features: {
      negativePrompt: false,
      referenceImage: true,
      batchOutputs: false,
      maxBatchSize: 1,
      seed: true,
      refStrength: false,
    },
    description: 'Mesma família, mais barato — iterações rápidas',
  },
  {
    id: 'flux-1-dev',
    name: 'Flux.1 Dev',
    tier: 'standard',
    endpoint:
      process.env.SEGMIND_FLUX_DEV_ENDPOINT ??
      'https://api.segmind.com/v1/flux-1-dev',
    pricePerImage: 0.025,
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
    defaultAspectRatio: '1:1',
    features: {
      negativePrompt: true,
      referenceImage: true,
      batchOutputs: false,
      maxBatchSize: 1,
      seed: true,
      refStrength: true,
    },
    description: 'Fallback universal, bom pra props e cenários',
  },
  {
    id: 'ideogram-v2',
    name: 'Ideogram v2',
    tier: 'standard',
    endpoint:
      process.env.SEGMIND_IDEOGRAM_V2_ENDPOINT ??
      'https://api.segmind.com/v1/ideogram-v2',
    pricePerImage: 0.08,
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    defaultAspectRatio: '1:1',
    features: {
      negativePrompt: true,
      referenceImage: false,
      batchOutputs: false,
      maxBatchSize: 1,
      seed: true,
      refStrength: false,
    },
    description: 'Quando precisa de texto dentro da imagem (placa, livro)',
  },
  {
    id: 'imagen-3',
    name: 'Google Imagen 3',
    tier: 'premium',
    endpoint:
      process.env.SEGMIND_IMAGEN_3_ENDPOINT ??
      'https://api.segmind.com/v1/imagen-3',
    pricePerImage: 0.05,
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    defaultAspectRatio: '1:1',
    features: {
      negativePrompt: true,
      referenceImage: false,
      batchOutputs: false,
      maxBatchSize: 1,
      seed: true,
      refStrength: false,
    },
    description: 'Fotorrealismo ocasional, alta fidelidade',
  },
]

export const DEFAULT_IMAGE_ENGINE_ID = 'nano-banana-pro'

export function getImageEngine(id: string): ImageEngine {
  return IMAGE_ENGINES.find(e => e.id === id) ?? IMAGE_ENGINES[0]
}

/** Body comum vindo do cliente */
export type CommonImageBody = {
  prompt: string
  aspect_ratio?: string
  num_outputs?: number
  seed?: number
  negative_prompt?: string
  reference_image_url?: string
  ref_strength?: number
}

/**
 * Transforma o body comum no payload específico de cada engine.
 * Se um campo não é suportado pela engine, ele é omitido.
 */
export function buildImagePayload(
  engine: ImageEngine,
  body: CommonImageBody
): Record<string, unknown> {
  const aspect = body.aspect_ratio ?? engine.defaultAspectRatio

  const base: Record<string, unknown> = {
    prompt: body.prompt,
    aspect_ratio: aspect,
  }

  if (engine.features.seed && body.seed !== undefined) {
    base.seed = body.seed
  }

  if (engine.features.negativePrompt && body.negative_prompt) {
    base.negative_prompt = body.negative_prompt
  }

  if (engine.features.referenceImage && body.reference_image_url) {
    // Diferentes engines usam nomes diferentes pro campo de ref
    if (engine.id.startsWith('nano-banana')) {
      base.image_url = body.reference_image_url
    } else if (engine.id === 'flux-1-dev') {
      base.image = body.reference_image_url
      if (body.ref_strength !== undefined) base.strength = body.ref_strength
    } else {
      base.reference_image = body.reference_image_url
    }
  }

  return base
}
