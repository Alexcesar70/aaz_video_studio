import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import {
  IMAGE_ENGINES,
  DEFAULT_IMAGE_ENGINE_ID,
  getImageEngine,
  buildImagePayload,
  type CommonImageBody,
} from '@/lib/imageEngines'
import { getAuthUser } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { emitEvent } from '@/lib/activity'
import { checkBudget } from '@/lib/budget'
import { checkWalletBalance, spendCredits } from '@/lib/wallet'
import { getClientPrice, recordEngineCost } from '@/lib/pricing'

/**
 * POST /api/generate-image
 *
 * Body: {
 *   engineId?: string               // default: nano-banana-pro
 *   prompt: string
 *   aspect_ratio?: string
 *   num_outputs?: number            // default: 4 (cap 8)
 *   seed?: number
 *   negative_prompt?: string
 *   reference_image_url?: string
 *   ref_strength?: number
 * }
 *
 * Resposta: {
 *   engineId, imageUrls: string[]   // URLs no Vercel Blob, uma por variação
 * }
 *
 * A maioria dos motores do Segmind retorna 1 imagem por chamada — então
 * para gerar N variações fazemos N chamadas em paralelo (ou sequencial se
 * a engine não suportar batch). Seeds aleatórios garantem variação.
 */

export const maxDuration = 300
const FETCH_TIMEOUT_MS = 280_000
const DEFAULT_VARIATIONS = 4
const MAX_VARIATIONS = 8

type GenerateImageBody = CommonImageBody & { engineId?: string }

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.SEGMIND_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'SEGMIND_API_KEY não configurada no servidor.' },
        { status: 500 }
      )
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'BLOB_READ_WRITE_TOKEN não configurado.' },
        { status: 500 }
      )
    }

    let body: GenerateImageBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Request body inválido.' }, { status: 400 })
    }

    if (!body.prompt?.trim()) {
      return NextResponse.json({ error: 'prompt é obrigatório.' }, { status: 400 })
    }

    // ── Permission check ──
    const preAuthUser = getAuthUser(request)
    if (preAuthUser && !hasPermission(preAuthUser.permissions, preAuthUser.role, PERMISSIONS.GENERATE_IMAGE)) {
      return NextResponse.json({ error: 'Sem permissão para gerar imagens.' }, { status: 403 })
    }

    const engineId = body.engineId ?? DEFAULT_IMAGE_ENGINE_ID
    const engine = IMAGE_ENGINES.find(e => e.id === engineId) ?? getImageEngine(DEFAULT_IMAGE_ENGINE_ID)

    const n = Math.min(
      Math.max(body.num_outputs ?? DEFAULT_VARIATIONS, 1),
      MAX_VARIATIONS
    )

    // ── Budget check — bloqueia antes de gastar se user atingiu cap ──
    if (preAuthUser) {
      const estimatedCost = n * engine.pricePerImage
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
          { status: 402 }
        )
      }
    }

    // ── Wallet balance check — usa preço do cliente (com margem) ──
    let walletId: string | null = null
    const clientPricePerImg = await getClientPrice(engine.id, engine.pricePerImage)
    if (preAuthUser) {
      const walletCheck = await checkWalletBalance(preAuthUser.id, preAuthUser.organizationId, n * clientPricePerImg)
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

    // Gera N chamadas paralelas, cada uma com seed diferente
    const baseSeed = body.seed ?? Math.floor(Math.random() * 1_000_000)
    const tasks: Promise<{ ok: true; url: string } | { ok: false; error: string }>[] = []

    for (let i = 0; i < n; i++) {
      const seed = baseSeed + i * 7919
      const enginePayload = buildImagePayload(engine, { ...body, seed })
      const payloadStr = JSON.stringify(enginePayload)

      tasks.push(
        (async () => {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
          try {
            const res = await fetch(engine.endpoint, {
              method: 'POST',
              headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
              },
              body: payloadStr,
              signal: controller.signal,
            })

            if (!res.ok) {
              const errText = await res.text().catch(() => '')
              let msg = `${engine.name} retornou ${res.status}`
              try {
                const j = JSON.parse(errText)
                msg = j?.detail ?? j?.error ?? j?.message ?? msg
              } catch {
                if (errText) msg = errText.slice(0, 200)
              }
              return { ok: false as const, error: msg }
            }

            // Segmind às vezes retorna JSON { image: "base64..." } ou binário direto.
            // Detectamos pelo Content-Type.
            const contentType = res.headers.get('content-type') ?? ''
            let imgBuffer: ArrayBuffer

            if (contentType.includes('application/json')) {
              const data = await res.json() as {
                image?: string
                images?: string[]
                output?: string | string[]
                url?: string
              }
              // Possíveis shapes: { image: base64 }, { images: [url|base64] },
              // { output: url }, { url }
              const raw =
                data.image ??
                (Array.isArray(data.images) ? data.images[0] : undefined) ??
                (Array.isArray(data.output) ? data.output[0] : data.output) ??
                data.url

              if (!raw) {
                return { ok: false as const, error: 'Resposta JSON sem imagem.' }
              }

              if (typeof raw === 'string' && (raw.startsWith('http://') || raw.startsWith('https://'))) {
                // URL remota — precisamos baixar pra republicar no Blob
                const imgRes = await fetch(raw)
                if (!imgRes.ok) {
                  return { ok: false as const, error: `Download da imagem falhou: ${imgRes.status}` }
                }
                imgBuffer = await imgRes.arrayBuffer()
              } else if (typeof raw === 'string') {
                // base64 (possivelmente com data: prefix)
                const b64 = raw.includes(',') ? raw.split(',', 2)[1] : raw
                imgBuffer = Buffer.from(b64, 'base64').buffer.slice(0) as ArrayBuffer
              } else {
                return { ok: false as const, error: 'Formato de imagem desconhecido.' }
              }
            } else {
              // Binário direto
              imgBuffer = await res.arrayBuffer()
            }

            // Upload pro Blob
            const filename = `asset-${engine.id}-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.png`
            const blob = await put(filename, Buffer.from(imgBuffer), {
              access: 'public',
              contentType: 'image/png',
              addRandomSuffix: false,
            })

            return { ok: true as const, url: blob.url }
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
              return { ok: false as const, error: `${engine.name} timeout` }
            }
            return { ok: false as const, error: err instanceof Error ? err.message : 'Erro desconhecido' }
          } finally {
            clearTimeout(timeout)
          }
        })()
      )
    }

    const results = await Promise.all(tasks)
    const imageUrls = results.filter(r => r.ok).map(r => (r as { ok: true; url: string }).url)
    const errors = results.filter(r => !r.ok).map(r => (r as { ok: false; error: string }).error)

    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma variação foi gerada.', details: errors },
        { status: 502 }
      )
    }

    console.log(
      `[/api/generate-image] engine=${engine.id} ok=${imageUrls.length}/${n} ` +
      `errors=${errors.length}`
    )

    // ── Registra custo real para média dinâmica ──
    if (imageUrls.length > 0) {
      recordEngineCost(engine.id, engine.pricePerImage).catch(() => {})
    }

    // ── Wallet deduction — cobra preço do CLIENTE (com margem) ──
    const clientChargeUsd = imageUrls.length * clientPricePerImg
    let walletDeducted = false
    if (walletId && clientChargeUsd > 0) {
      try {
        const txn = await spendCredits(walletId, clientChargeUsd, `${imageUrls.length} imagem(ns) · ${engine.name}`, {
          generationType: 'image',
          engineId: engine.id,
          userId: preAuthUser?.id,
        })
        walletDeducted = txn !== null
        if (!walletDeducted) {
          console.warn(`[/api/generate-image] Wallet deduction failed — insufficient balance (walletId=${walletId}, cost=${clientChargeUsd})`)
        }
      } catch (walletErr) {
        console.error('[/api/generate-image] Wallet deduction error:', walletErr)
      }
    }

    // Activity event — custo estimado baseado em imagens OK
    const authUser = getAuthUser(request)
    if (authUser) {
      emitEvent({
        userId: authUser.id,
        userName: authUser.name,
        userEmail: authUser.email,
        userRole: authUser.role,
        organizationId: authUser.organizationId,
        type: 'image_generated',
        meta: {
          cost: clientChargeUsd,
          engineId: engine.id,
          variations: imageUrls.length,
          extra: { walletDeducted },
        },
      }).catch(() => {})
    }

    return NextResponse.json({
      engineId: engine.id,
      imageUrls,
      errors: errors.length ? errors : undefined,
    })
  } catch (err) {
    console.error('[/api/generate-image]', err)
    const message = err instanceof Error ? err.message : 'Erro interno.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
