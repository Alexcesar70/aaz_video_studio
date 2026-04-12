import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import {
  VIDEO_ENGINES,
  DEFAULT_ENGINE_ID,
  getEngine,
  buildEnginePayload,
  type CommonVideoBody,
} from '@/lib/videoEngines'
import { getAuthUser } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { emitEvent } from '@/lib/activity'
import { checkBudget } from '@/lib/budget'
import { getSegmindCredits } from '@/lib/segmind'
import { checkWalletBalance, spendCredits } from '@/lib/wallet'
import { getClientPrice, recordEngineCost } from '@/lib/pricing'

/**
 * POST /api/generate
 * Proxy server-side multi-engine para Segmind.
 * O body deve incluir `engineId` (ex: 'seedance-2.0'). O adapter
 * transforma o body comum no payload específico da engine escolhida.
 *
 * Recebe o vídeo gerado, faz upload ao Vercel Blob e retorna a URL pública.
 *
 * Resposta: { videoUrl: string, engineId: string }
 */

export const maxDuration = 300

const FETCH_TIMEOUT_MS = 290_000

type GenerateBody = CommonVideoBody & { engineId?: string }

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.SEGMIND_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'SEGMIND_API_KEY não configurada no servidor.' },
        { status: 500 }
      )
    }

    let body: GenerateBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Request body inválido ou muito grande. Reduza o número/tamanho das imagens.' }, { status: 413 })
    }

    // Validação mínima
    if (!body.prompt?.trim()) {
      return NextResponse.json({ error: 'prompt é obrigatório.' }, { status: 400 })
    }
    if (!body.duration || !body.aspect_ratio) {
      return NextResponse.json({ error: 'duration e aspect_ratio são obrigatórios.' }, { status: 400 })
    }

    // ── Permission check — bloqueia se user não tem permissão ──
    const preAuthUser = getAuthUser(request)
    if (preAuthUser && !hasPermission(preAuthUser.permissions, preAuthUser.role, PERMISSIONS.GENERATE_VIDEO)) {
      return NextResponse.json({ error: 'Sem permissão para gerar vídeos.' }, { status: 403 })
    }

    // Resolve engine — default se não vier id válido
    const engineId = body.engineId ?? DEFAULT_ENGINE_ID
    const engine = VIDEO_ENGINES.find(e => e.id === engineId) ?? getEngine(DEFAULT_ENGINE_ID)

    // ── Budget check — bloqueia antes de gastar se user atingiu cap ──
    if (preAuthUser) {
      const estimatedCost = (body.duration ?? 0) * engine.pricePerSecond
      const budget = await checkBudget(preAuthUser.id, estimatedCost)
      if (!budget.allowed) {
        return NextResponse.json(
          {
            error: budget.reason,
            budget: {
              usedUsd: budget.usedUsd,
              capUsd: budget.capUsd,
              percentageUsed: budget.percentageUsed,
            },
          },
          { status: 402 } // Payment Required (usado pra budget exceeded)
        )
      }
    }

    // ── Wallet balance check — usa preço do cliente (com margem) ──
    let walletId: string | null = null
    const clientPricePerSec = await getClientPrice(engine.id, engine.pricePerSecond)
    const clientEstimatedCost = (body.duration ?? 0) * clientPricePerSec
    if (preAuthUser) {
      const walletCheck = await checkWalletBalance(preAuthUser.id, preAuthUser.organizationId, clientEstimatedCost)
      walletId = walletCheck.walletId
      if (!walletCheck.allowed) {
        return NextResponse.json(
          {
            error: walletCheck.reason,
            wallet: { balance: walletCheck.balance, walletId: walletCheck.walletId },
          },
          { status: 402 }
        )
      }
    }

    // Override opcional por env var — só aplica ao Seedance 2.0 default
    // (permite trocar o endpoint do Seedance sem mexer no código)
    const endpoint =
      engine.id === DEFAULT_ENGINE_ID && process.env.SEGMIND_VIDEO_ENDPOINT
        ? process.env.SEGMIND_VIDEO_ENDPOINT
        : engine.endpoint

    // ── Monta o payload via adapter ────────────────────────────
    const enginePayload = buildEnginePayload(engine, body)

    const payloadStr = JSON.stringify(enginePayload)
    const payloadSizeMB = (payloadStr.length / 1024 / 1024).toFixed(2)
    console.log(
      `[/api/generate] engine=${engine.id} payload=${payloadSizeMB}MB ` +
      `mode=${body.mode} refs=${body.reference_images?.length ?? 0}`
    )

    // ── Captura saldo antes — para calcular custo real após a geração ──
    const creditsBefore = await getSegmindCredits(apiKey)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    let segmindRes: Response
    try {
      segmindRes = await fetch(endpoint, {
        method:  'POST',
        headers: {
          'x-api-key':     apiKey,
          'Content-Type':  'application/json',
        },
        body: payloadStr,
        signal: controller.signal,
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return NextResponse.json({ error: `${engine.name} não respondeu no tempo limite.` }, { status: 504 })
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }

    if (!segmindRes.ok) {
      const errorText = await segmindRes.text().catch(() => '')
      let message = `${engine.name} retornou ${segmindRes.status}`
      try {
        const errorData = JSON.parse(errorText)
        message = errorData?.detail ?? errorData?.error ?? errorData?.message ?? message
      } catch {
        if (errorText) message = errorText.slice(0, 200)
      }
      console.error('[/api/generate] Segmind error:', engine.id, segmindRes.status, message)
      return NextResponse.json({ error: message }, { status: segmindRes.status })
    }

    // Recebe o vídeo do Segmind
    const videoBuffer = await segmindRes.arrayBuffer()
    const videoSizeMB = (videoBuffer.byteLength / 1024 / 1024).toFixed(2)
    console.log(`[/api/generate] Video recebido: ${videoSizeMB}MB (engine=${engine.id})`)

    // Upload permanente ao Vercel Blob
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'BLOB_READ_WRITE_TOKEN não configurado — vídeo não pode ser persistido.' },
        { status: 500 }
      )
    }

    const filename = `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`
    const blob = await put(filename, Buffer.from(videoBuffer), {
      access: 'public',
      contentType: 'video/mp4',
      addRandomSuffix: false,
    })

    console.log(`[/api/generate] Vídeo salvo no Blob: ${blob.url}`)

    // ── Captura saldo depois — calcula custo real da geração ──
    const creditsAfter = await getSegmindCredits(apiKey)
    const estimatedCostUsd = (body.duration ?? 0) * engine.pricePerSecond
    const realCostUsd =
      creditsBefore !== null && creditsAfter !== null
        ? Math.max(0, creditsBefore - creditsAfter)
        : null

    const costUsd = realCostUsd ?? estimatedCostUsd
    const costSource = realCostUsd !== null ? 'real' : 'estimated'

    console.log(
      `[/api/generate] Custo: $${costUsd.toFixed(4)} (${costSource})` +
      ` | before=${creditsBefore} after=${creditsAfter}`
    )

    // ── Registra custo real para média dinâmica da pricing table ──
    if (costUsd > 0 && body.duration && body.duration > 0) {
      recordEngineCost(engine.id, costUsd / body.duration).catch(() => {})
    }

    // ── Wallet deduction — cobra o preço do CLIENTE (com margem), não o custo real ──
    const clientChargeUsd = (body.duration ?? 0) * clientPricePerSec
    let walletDeducted = false
    if (walletId && clientChargeUsd > 0) {
      try {
        const txn = await spendCredits(walletId, clientChargeUsd, `Cena ${body.duration}s · ${engine.name}`, {
          generationType: 'video',
          engineId: engine.id,
          userId: preAuthUser?.id,
        })
        walletDeducted = txn !== null
        if (!walletDeducted) {
          console.warn(`[/api/generate] Wallet deduction failed — insufficient balance (walletId=${walletId}, cost=${costUsd})`)
        }
      } catch (walletErr) {
        console.error('[/api/generate] Wallet deduction error:', walletErr)
      }
    }

    // Activity event — fire and forget, não bloqueia
    const authUser = getAuthUser(request)
    if (authUser) {
      emitEvent({
        userId: authUser.id,
        userName: authUser.name,
        userEmail: authUser.email,
        userRole: authUser.role,
        organizationId: authUser.organizationId,
        type: 'scene_generated',
        meta: {
          cost: clientChargeUsd,
          engineId: engine.id,
          duration: body.duration,
          extra: {
            costSource,
            segmindCostUsd: costUsd,
            clientPricePerSec,
            walletDeducted,
          },
        },
      }).catch(() => {})
    }

    return NextResponse.json({
      videoUrl: blob.url,
      pathname: blob.pathname,
      sizeMB: videoSizeMB,
      engineId: engine.id,
      costUsd,
      costSource,
      estimatedCostUsd,
      realCostUsd,
    })

  } catch (err) {
    console.error('[/api/generate]', err)
    const message = err instanceof Error ? err.message : 'Erro interno ao processar a requisição.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
