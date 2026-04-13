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

export const maxDuration = 300

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

    // Limpa markdown e tags da letra antes de enviar ao Suno
    const cleanPrompt = prompt.trim()
      .replace(/\*\*/g, '')           // remove bold markdown
      .replace(/\[([^\]]*)\]/g, '')   // remove [Verso 1], [Refrão] etc.
      .replace(/\n{3,}/g, '\n\n')    // normaliza quebras de linha
      .trim()

    // Callback URL — Suno exige mesmo que não usemos (usamos polling)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aaz-video-studio.vercel.app'

    // Chamada ao Suno API
    const sunoPayload: Record<string, unknown> = {
      prompt: cleanPrompt,
      customMode,
      instrumental,
      model: 'V4',
      callBackUrl: `${appUrl}/api/webhooks/suno`,
    }
    if (customMode) {
      sunoPayload.title = title || 'Cantiga AAZ'
      sunoPayload.style = style || "children's christian song, gentle acoustic guitar, warm female vocals, Portuguese Brazilian"
    }

    console.log(`[/api/generate-music] Gerando música: "${title}" (custom=${customMode}, instrumental=${instrumental})`)

    // Passo 1: POST para iniciar geração (retorna taskId)
    const sunoRes = await fetch(`${SUNO_API_BASE}/api/v1/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sunoPayload),
    })

    if (!sunoRes.ok) {
      const errText = await sunoRes.text().catch(() => '')
      console.error('[/api/generate-music] Suno error:', sunoRes.status, errText.slice(0, 300))
      let errMsg = `Suno retornou ${sunoRes.status}`
      try { const d = JSON.parse(errText); errMsg = d.msg ?? d.error ?? d.detail ?? errMsg } catch {}
      return NextResponse.json({ error: errMsg }, { status: sunoRes.status })
    }

    const sunoData = await sunoRes.json()
    console.log('[/api/generate-music] Suno POST response:', JSON.stringify(sunoData).slice(0, 500))

    // Verifica se a resposta indica erro
    if (sunoData?.code && sunoData.code !== 200) {
      console.error('[/api/generate-music] Suno API error:', JSON.stringify(sunoData))
      return NextResponse.json({ error: sunoData.msg ?? `Suno erro: ${sunoData.code}` }, { status: 400 })
    }

    const taskId = sunoData?.data?.taskId ?? sunoData?.taskId ?? sunoData?.data?.task_id ?? sunoData?.task_id
    if (!taskId) {
      console.error('[/api/generate-music] Sem taskId:', JSON.stringify(sunoData).slice(0, 500))
      return NextResponse.json({ error: 'Suno não retornou taskId. Verifique os logs da Vercel.' }, { status: 500 })
    }

    // Passo 2: Polling — aguarda até 90s (a geração leva ~20-30s)
    let musicUrl = ''
    let songTitle = title || 'Cantiga'
    let duration = 0
    let songs: Record<string, unknown>[] = []
    const maxAttempts = 50
    const pollInterval = 5000 // 5s = até 250s total

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, pollInterval))

      try {
        const pollRes = await fetch(`${SUNO_API_BASE}/api/v1/generate/record-info?taskId=${taskId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        })
        if (!pollRes.ok) continue

        const pollData = await pollRes.json()
        const status = pollData?.data?.status ?? pollData?.status
        console.log(`[/api/generate-music] Poll #${attempt + 1}: status=${status}`)

        if (status === 'SUCCESS' || status === 'success' || status === 'completed' || status === 'COMPLETED') {
          console.log('[/api/generate-music] Poll SUCCESS data:', JSON.stringify(pollData).slice(0, 1000))
          // Tenta múltiplos caminhos na resposta
          const responseData = pollData?.data?.response?.sunoData ?? pollData?.data?.response?.data ?? pollData?.data?.sunoData ?? pollData?.data?.data ?? pollData?.data?.response ?? pollData?.data ?? []
          songs = Array.isArray(responseData) ? responseData : [responseData]
          const firstSong = songs[0] ?? {}
          musicUrl = (firstSong.audio_url ?? firstSong.audioUrl ?? firstSong.stream_audio_url ?? firstSong.streamAudioUrl ?? '') as string
          songTitle = (firstSong.title ?? title ?? 'Cantiga') as string
          duration = (firstSong.duration ?? 0) as number
          if (!musicUrl) {
            // Tenta extrair de qualquer campo que contenha URL de áudio
            const dataStr = JSON.stringify(pollData)
            const urlMatch = dataStr.match(/"(https?:\/\/[^"]+\.(?:mp3|wav|m4a|ogg)(?:\?[^"]*)?)"/)
            if (urlMatch) musicUrl = urlMatch[1]
          }
          break
        }

        if (status === 'FAILED' || status === 'failed' || status === 'error') {
          return NextResponse.json({ error: 'Suno falhou ao gerar a música. Tente novamente.' }, { status: 500 })
        }
        // Continua polling...
      } catch (pollErr) {
        console.error('[/api/generate-music] Poll error:', pollErr)
      }
    }

    if (!musicUrl) {
      return NextResponse.json({ error: 'Música não ficou pronta no tempo limite (4min). Tente novamente.' }, { status: 504 })
    }

    console.log(`[/api/generate-music] Música pronta: ${musicUrl} (${duration}s)`)

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
