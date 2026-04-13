/**
 * Domain: Video Generation
 *
 * Entidades e interfaces do núcleo — não dependem de nada externo.
 * Este é o contrato que qualquer provider de vídeo deve seguir.
 */

export interface VideoGenerationRequest {
  prompt: string
  duration: number
  aspectRatio: string
  resolution?: string
  engineId: string
  generateAudio?: boolean
  mode?: 'text_to_video' | 'first_last_frames' | 'omni_reference'
  referenceImages?: string[]
  referenceVideos?: string[]
  referenceAudios?: string[]
  firstFrameUrl?: string
  lastFrameUrl?: string
}

export interface VideoGenerationResult {
  videoUrl: string
  pathname: string
  sizeMB: string
  engineId: string
  costUsd: number
  costSource: 'real' | 'estimated'
  clientChargeUsd: number
}

export interface CostBreakdown {
  realCostUsd: number | null
  estimatedCostUsd: number
  clientChargeUsd: number
  costSource: 'real' | 'estimated'
  clientPricePerUnit: number
}

/**
 * Interface do Video Provider — abstração do serviço de geração.
 *
 * Qualquer provider (Segmind, Replicate, fal.ai) implementa isso.
 * O domínio NUNCA importa o provider diretamente.
 */
export interface VideoProvider {
  /** Gera um vídeo e retorna o buffer bruto */
  generate(payload: Record<string, unknown>, endpoint: string): Promise<ArrayBuffer>

  /** Captura saldo/créditos do provider (para cálculo de custo real) */
  getCredits(): Promise<number | null>
}

/**
 * Interface do Storage — abstração do armazenamento de arquivos.
 */
export interface VideoStorage {
  /** Salva vídeo e retorna URL pública + pathname */
  save(buffer: ArrayBuffer, filename: string): Promise<{ url: string; pathname: string }>
}

/**
 * Erros de domínio — tipados para o controller tratar com status HTTP correto.
 */
export class PermissionError extends Error {
  constructor(message: string) { super(message); this.name = 'PermissionError' }
}

export class InsufficientBalanceError extends Error {
  public balance?: number
  public required?: number
  constructor(message: string, balance?: number, required?: number) {
    super(message); this.name = 'InsufficientBalanceError'
    this.balance = balance; this.required = required
  }
}

export class ProviderError extends Error {
  public statusCode: number
  constructor(message: string, statusCode: number) {
    super(message); this.name = 'ProviderError'; this.statusCode = statusCode
  }
}

export class ValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'ValidationError' }
}
