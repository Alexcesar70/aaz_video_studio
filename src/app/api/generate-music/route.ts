/**
 * POST /api/generate-music
 * Proxy para Suno API — gera música com letra customizada.
 *
 * Body:
 *  - prompt: string (descrição geral da música OU letra completa)
 *  - title: string (título da cantiga)
 *  - style: string (estilo musical, ex: "children's christian song")
 *  - customMode: boolean (true = usa prompt como letra)
 *  - instrumental: boolean (true = sem vocal)
 *
 * Resposta: { musicUrl, title, duration, id }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { emitEvent } from '@/lib/activity'
import { checkWalletBalance, spendCredits } from '@/lib/wallet'
import { getClientPrice, recordEngineCost } from '@/lib/pricing'

export const maxDuration = 120

const SUNO_API_BASE = 'https://api.sunoapi.org'

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.SUNO_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'SUNO_API_KEY não configurada.' }, { status: 500 })
    }

    const authUser = getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    // Permission check
    if (!hasPermission(authUser.permissions, authUser.role, PERMISSIONS.GENERATE_VIDEO)) {
      return NextResponse.json({ error: 'Sem permissão para gerar música.' }, { status: 403 })
    }

    const body = await request.json()
    const { prompt, title, style, customMode = true, instrumental = false } = body

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'prompt (letra ou descrição) é obrigatório.' }, { status: 400 })
    }

    // Wallet check
    const clientPrice = await getClientPrice('suno-v4', 0.11)
    let walletId: string | null = null
    if (authUser.organizationId) {
      const walletCheck = await checkWalletBalance(authUser.id, authUser.organizationId, clientPrice)
      walletId = walletCheck.walletId
      if (!walletCheck.allowed) {
        return NextResponse.json({ error: walletCheck.reason, wallet: { balance: walletCheck.balance } }, { status: 402 })
      }
    }

    // Chamada ao Suno API
    const sunoPayload: Record<string, unknown> = {
      prompt: prompt.trim(),
      customMode,
      instrumental,
      model: 'suno-v4',
      wait_audio: true,
    }
    if (customMode) {
      sunoPayload.title = title || 'Cantiga AAZ'
      sunoPayload.style = style || "children's christian song, gentle acoustic guitar, warm female vocals, Portuguese Brazilian"
    }

    console.log(`[/api/generate-music] Gerando música: "${title}" (custom=${customMode}, instrumental=${instrumental})`)

    const sunoRes = await fetch(`${SUNO_API_BASE}/api/v1/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sunoPayload),
    })

    if (!sunoRes.ok) {
      const errData = await sunoRes.json().catch(() => ({}))
      const errMsg = (errData as Record<string, string>)?.detail ?? (errData as Record<string, string>)?.error ?? `Suno retornou ${sunoRes.status}`
      console.error('[/api/generate-music] Suno error:', sunoRes.status, errMsg)
      return NextResponse.json({ error: errMsg }, { status: sunoRes.status })
    }

    const sunoData = await sunoRes.json()
    console.log('[/api/generate-music] Suno response:', JSON.stringify(sunoData).slice(0, 500))

    // Extrai URLs da resposta (Suno retorna array de 2 variações)
    const songs = Array.isArray(sunoData?.data)
      ? sunoData.data
      : Array.isArray(sunoData)
        ? sunoData
        : sunoData?.data ? [sunoData.data] : []

    const firstSong = songs[0]
    const musicUrl = firstSong?.audio_url ?? firstSong?.audioUrl ?? ''
    const songTitle = firstSong?.title ?? title ?? 'Cantiga'
    const duration = firstSong?.duration ?? 0

    if (!musicUrl) {
      // Pode ser async — precisa polling
      const taskId = sunoData?.task_id ?? sunoData?.id ?? firstSong?.id
      if (taskId) {
        // Retorna o taskId para polling no frontend
        return NextResponse.json({
          status: 'processing',
          taskId,
          message: 'Música em geração. Use o taskId para verificar o status.',
        })
      }
      return NextResponse.json({ error: 'Não foi possível obter a URL da música.' }, { status: 500 })
    }

    // Custo real (fixo por música)
    const realCost = 0.11
    recordEngineCost('suno-v4', realCost).catch(() => {})

    // Wallet deduction
    let walletDeducted = false
    if (walletId && clientPrice > 0) {
      try {
        const txn = await spendCredits(walletId, clientPrice, `Cantiga · ${songTitle}`, {
          generationType: 'music',
          engineId: 'suno-v4',
          userId: authUser.id,
        })
        walletDeducted = txn !== null
      } catch (err) {
        console.error('[/api/generate-music] Wallet deduction error:', err)
      }
    }

    // Activity event
    emitEvent({
      userId: authUser.id,
      userName: authUser.name,
      userEmail: authUser.email,
      userRole: authUser.role,
      organizationId: authUser.organizationId,
      type: 'scene_generated', // reutiliza tipo existente por ora
      meta: {
        cost: clientPrice,
        engineId: 'suno-v4',
        label: `Cantiga: ${songTitle}`,
        extra: {
          costSource: 'real',
          segmindCostUsd: realCost,
          walletDeducted,
          musicGeneration: true,
        },
      },
    }).catch(() => {})

    return NextResponse.json({
      musicUrl,
      title: songTitle,
      duration,
      songs: songs.map((s: Record<string, unknown>) => ({
        id: s.id,
        title: s.title,
        audioUrl: s.audio_url ?? s.audioUrl,
        duration: s.duration,
        imageUrl: s.image_url ?? s.imageUrl,
      })),
      costUsd: clientPrice,
    })

  } catch (err) {
    console.error('[/api/generate-music]', err)
    return NextResponse.json({ error: 'Erro ao gerar música.' }, { status: 500 })
  }
}
