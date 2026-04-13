/**
 * Use Case: Generate Video
 *
 * Orquestra todo o fluxo de geração de vídeo:
 * 1. Valida input
 * 2. Verifica permissões
 * 3. Verifica budget + wallet
 * 4. Chama o provider (Segmind)
 * 5. Salva no storage (Blob)
 * 6. Calcula custo real
 * 7. Cobra da wallet (preço do cliente)
 * 8. Registra evento de atividade
 *
 * Cada passo é uma responsabilidade delegada.
 * O use case apenas ORQUESTRA — não implementa nada.
 */

import type {
  VideoProvider,
  VideoStorage,
  VideoGenerationRequest,
  VideoGenerationResult,
  CostBreakdown,
} from '@/domain/videoGeneration'
import {
  ValidationError,
  PermissionError,
  InsufficientBalanceError,
} from '@/domain/videoGeneration'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { checkBudget } from '@/lib/budget'
import { checkWalletBalance, spendCredits } from '@/lib/wallet'
import { getClientPrice, recordEngineCost } from '@/lib/pricing'
import { emitEvent } from '@/lib/activity'
import {
  VIDEO_ENGINES,
  DEFAULT_ENGINE_ID,
  getEngine,
  buildEnginePayload,
} from '@/lib/videoEngines'

interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  organizationId?: string
  permissions?: string[]
}

interface GenerateVideoInput {
  request: VideoGenerationRequest
  user: AuthUser
}

export async function generateVideo(
  provider: VideoProvider,
  storage: VideoStorage,
  input: GenerateVideoInput
): Promise<VideoGenerationResult> {
  const { request: req, user } = input

  // ── 1. Validação ──
  validate(req)

  // ── 2. Permissões ──
  checkPermissions(user)

  // ── 3. Resolve engine ──
  const engineId = req.engineId ?? DEFAULT_ENGINE_ID
  const engine = VIDEO_ENGINES.find(e => e.id === engineId) ?? getEngine(DEFAULT_ENGINE_ID)

  // ── 4. Budget + Wallet checks ──
  const clientPricePerSec = await getClientPrice(engine.id, engine.pricePerSecond)
  const clientEstimatedCost = (req.duration ?? 0) * clientPricePerSec
  const walletId = await checkFinancials(user, engine.pricePerSecond, req.duration, clientEstimatedCost)

  // ── 5. Resolve endpoint ──
  const endpoint = engine.id === DEFAULT_ENGINE_ID && process.env.SEGMIND_VIDEO_ENDPOINT
    ? process.env.SEGMIND_VIDEO_ENDPOINT
    : engine.endpoint

  // ── 6. Captura saldo ANTES ──
  const creditsBefore = await provider.getCredits()

  // ── 7. Chama provider ──
  const enginePayload = buildEnginePayload(engine, {
    prompt: req.prompt,
    duration: req.duration,
    aspect_ratio: req.aspectRatio,
    resolution: req.resolution,
    generate_audio: req.generateAudio,
    mode: req.mode,
    reference_images: req.referenceImages,
    reference_videos: req.referenceVideos,
    reference_audios: req.referenceAudios,
    first_frame_url: req.firstFrameUrl,
    last_frame_url: req.lastFrameUrl,
  })

  console.log(`[generateVideo] engine=${engine.id} duration=${req.duration}s`)
  const videoBuffer = await provider.generate(enginePayload, endpoint)
  const videoSizeMB = (videoBuffer.byteLength / 1024 / 1024).toFixed(2)

  // ── 8. Salva no storage ──
  const filename = `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`
  const { url: videoUrl, pathname } = await storage.save(videoBuffer, filename)

  // ── 9. Calcula custo real ──
  const cost = await calculateCost(provider, creditsBefore, engine.pricePerSecond, req.duration, clientPricePerSec)

  // ── 10. Registra custo + cobra wallet ──
  if (cost.realCostUsd !== null && req.duration > 0) {
    recordEngineCost(engine.id, cost.realCostUsd / req.duration).catch(() => {})
  }

  if (walletId && cost.clientChargeUsd > 0) {
    await spendCredits(walletId, cost.clientChargeUsd, `Cena ${req.duration}s · ${engine.name}`, {
      generationType: 'video', engineId: engine.id, userId: user.id,
    }).catch(err => console.error('[generateVideo] Wallet deduction error:', err))
  }

  // ── 11. Evento de atividade ──
  emitEvent({
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    userRole: user.role,
    organizationId: user.organizationId,
    type: 'scene_generated',
    meta: {
      cost: cost.clientChargeUsd,
      engineId: engine.id,
      duration: req.duration,
      extra: {
        costSource: cost.costSource,
        segmindCostUsd: cost.realCostUsd ?? cost.estimatedCostUsd,
        clientPricePerUnit: cost.clientPricePerUnit,
      },
    },
  }).catch(() => {})

  return {
    videoUrl,
    pathname,
    sizeMB: videoSizeMB,
    engineId: engine.id,
    costUsd: cost.realCostUsd ?? cost.estimatedCostUsd,
    costSource: cost.costSource,
    clientChargeUsd: cost.clientChargeUsd,
  }
}

// ── Funções privadas (helpers internos do use case) ──

function validate(req: VideoGenerationRequest): void {
  if (!req.prompt?.trim()) throw new ValidationError('prompt é obrigatório.')
  if (!req.duration || !req.aspectRatio) throw new ValidationError('duration e aspect_ratio são obrigatórios.')
}

function checkPermissions(user: AuthUser): void {
  if (!hasPermission(user.permissions, user.role, PERMISSIONS.GENERATE_VIDEO)) {
    throw new PermissionError('Sem permissão para gerar vídeos.')
  }
}

async function checkFinancials(
  user: AuthUser,
  pricePerSecond: number,
  duration: number,
  clientEstimatedCost: number
): Promise<string | null> {
  // Budget check
  const estimatedCost = duration * pricePerSecond
  const budget = await checkBudget(user.id, estimatedCost)
  if (!budget.allowed) {
    throw new InsufficientBalanceError(budget.reason ?? 'Budget excedido')
  }

  // Wallet check
  let walletId: string | null = null
  if (user.organizationId) {
    const wc = await checkWalletBalance(user.id, user.organizationId, clientEstimatedCost)
    walletId = wc.walletId
    if (!wc.allowed) {
      throw new InsufficientBalanceError(wc.reason ?? 'Saldo insuficiente', wc.balance, clientEstimatedCost)
    }
  }
  return walletId
}

async function calculateCost(
  provider: VideoProvider,
  creditsBefore: number | null,
  pricePerSecond: number,
  duration: number,
  clientPricePerSec: number
): Promise<CostBreakdown> {
  const creditsAfter = await provider.getCredits()
  const estimatedCostUsd = duration * pricePerSecond
  const realCostUsd = creditsBefore !== null && creditsAfter !== null
    ? Math.max(0, creditsBefore - creditsAfter)
    : null
  const costSource = realCostUsd !== null ? 'real' as const : 'estimated' as const
  const clientChargeUsd = duration * clientPricePerSec

  return { realCostUsd, estimatedCostUsd, clientChargeUsd, costSource, clientPricePerUnit: clientPricePerSec }
}
