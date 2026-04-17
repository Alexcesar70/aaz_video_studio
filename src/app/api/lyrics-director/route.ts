/**
 * POST /api/lyrics-director
 * Claude gera letra de cantiga OU storyboard visual a partir da letra.
 *
 * Body:
 *  - mode: 'lyrics' | 'storyboard'
 *  - prompt: string (ideia da cantiga para lyrics, OU letra completa para storyboard)
 *  - characters?: string[] (personagens a incluir)
 *  - theme?: string (tema central: compartilhar, perdão, etc.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { emitEvent } from '@/lib/activity'
import { checkWalletBalance, spendCredits } from '@/lib/wallet'
import { getClientPrice, recordEngineCost } from '@/lib/pricing'
import {
  resolveLyricsDirectorSystem,
  resolveStoryboardDirectorSystem,
  resolveSongPromptGeneratorSystem,
  RedisPromptTemplateRepository,
  type ResolvedLyricsSystem,
} from '@/modules/prompts'

export async function POST(request: NextRequest) {
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 })
    }

    const authUser = getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await request.json()
    const { mode = 'lyrics', prompt, characters, theme } = body

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'prompt é obrigatório.' }, { status: 400 })
    }

    // Wallet check
    const clientPrice = await getClientPrice('scene-director', 0.015) // mesmo custo do scene director
    let walletId: string | null = null
    if (authUser.organizationId) {
      const walletCheck = await checkWalletBalance(authUser.id, authUser.organizationId, clientPrice)
      walletId = walletCheck.walletId
      if (!walletCheck.allowed) {
        return NextResponse.json({ error: walletCheck.reason }, { status: 402 })
      }
    }

    const repo = new RedisPromptTemplateRepository()
    const ws = authUser.organizationId ?? null
    let resolved: ResolvedLyricsSystem
    if (mode === 'storyboard') {
      resolved = await resolveStoryboardDirectorSystem({ repo }, { workspaceId: ws })
    } else if (mode === 'generate_prompt') {
      resolved = await resolveSongPromptGeneratorSystem({ repo }, { workspaceId: ws })
    } else {
      resolved = await resolveLyricsDirectorSystem({ repo }, { workspaceId: ws })
    }
    const systemPrompt = resolved.prompt
    const promptSource = resolved.source
    const promptVersion = resolved.version

    let userMessage = prompt.trim()
    if (mode === 'lyrics') {
      if (characters?.length) userMessage += `\n\nPersonagens: ${characters.join(', ')}`
      if (theme) userMessage += `\nTema central: ${theme}`
    }

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.text().catch(() => '')
      return NextResponse.json({ error: `Claude retornou ${claudeRes.status}: ${err.slice(0, 200)}` }, { status: claudeRes.status })
    }

    const claudeData = await claudeRes.json() as {
      content: { type: string; text: string }[]
      usage?: { input_tokens?: number; output_tokens?: number }
    }

    const resultText = claudeData.content?.[0]?.text ?? ''
    const inputTokens = claudeData.usage?.input_tokens ?? 0
    const outputTokens = claudeData.usage?.output_tokens ?? 0
    const realCost = (inputTokens * 3 / 1_000_000) + (outputTokens * 15 / 1_000_000)

    // Record cost + wallet deduction
    if (realCost > 0) recordEngineCost('scene-director', realCost).catch(() => {})

    let walletDeducted = false
    if (walletId && clientPrice > 0) {
      try {
        const txn = await spendCredits(walletId, clientPrice, `Lyrics Director (${mode})`, {
          generationType: mode === 'storyboard' ? 'scene_director' : 'scene_director',
          userId: authUser.id,
        })
        walletDeducted = txn !== null
      } catch {}
    }

    emitEvent({
      userId: authUser.id,
      userName: authUser.name,
      userEmail: authUser.email,
      userRole: authUser.role,
      organizationId: authUser.organizationId,
      type: 'scene_director_called',
      meta: {
        cost: clientPrice,
        label: `Lyrics Director (${mode})`,
        extra: {
          claudeCostUsd: realCost,
          walletDeducted,
          promptSource,
          promptVersion,
        },
      },
    }).catch(() => {})

    // Parse storyboard se for JSON
    let storyboard = null
    if (mode === 'storyboard') {
      try {
        const jsonMatch = resultText.match(/\[[\s\S]*\]/)
        if (jsonMatch) storyboard = JSON.parse(jsonMatch[0])
      } catch {}
    }

    return NextResponse.json({
      mode,
      result: resultText,
      storyboard,
      costUsd: clientPrice,
    })

  } catch (err) {
    console.error('[/api/lyrics-director]', err)
    return NextResponse.json({ error: 'Erro ao gerar.' }, { status: 500 })
  }
}
