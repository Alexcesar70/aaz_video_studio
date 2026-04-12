import { NextRequest, NextResponse } from 'next/server'
import { getImageDirectorSystemPrompt } from '@/lib/imageDirectorSystem'
import type { AssetType } from '@/lib/assets'
import { getAuthUser } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { emitEvent } from '@/lib/activity'
import { checkWalletBalance, spendCredits } from '@/lib/wallet'
import { getClientPrice, recordEngineCost } from '@/lib/pricing'

/**
 * POST /api/image-director
 *
 * Transforma uma descrição curta do criador em um prompt técnico otimizado
 * pros motores de imagem, já com o bloco de estilo AAZ aplicado.
 *
 * Body: {
 *   type: 'character' | 'scenario' | 'item'
 *   description: string
 *   has_reference?: boolean   // se há uma imagem de ref anexada
 * }
 *
 * Resposta: {
 *   prompt: string            // prompt técnico em EN
 *   name_suggestion: string   // nome curto em PT-BR
 *   tags: string[]            // tags de busca em PT-BR
 * }
 */

interface ImageDirectorOutput {
  prompt: string
  name_suggestion: string
  tags: string[]
}

export async function POST(request: NextRequest) {
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY não configurada.' },
        { status: 500 }
      )
    }

    // ── Permission check ──
    const earlyAuth = getAuthUser(request)
    if (earlyAuth && !hasPermission(earlyAuth.permissions, earlyAuth.role, PERMISSIONS.USE_IMAGE_DIRECTOR)) {
      return NextResponse.json({ error: 'Sem permissão para usar o Image Director.' }, { status: 403 })
    }

    // ── Wallet balance check — usa preço do cliente (com margem) ──
    let walletId: string | null = null
    const clientPricePerCall = await getClientPrice('image-director', 0.005)
    if (earlyAuth) {
      const walletCheck = await checkWalletBalance(earlyAuth.id, earlyAuth.organizationId, clientPricePerCall)
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

    const body = await request.json() as {
      type?: AssetType
      description?: string
      has_reference?: boolean
      mood?: string
    }

    if (!body.type || !['character', 'scenario', 'item'].includes(body.type)) {
      return NextResponse.json(
        { error: 'type inválido (character|scenario|item).' },
        { status: 400 }
      )
    }
    if (!body.description?.trim()) {
      return NextResponse.json({ error: 'description é obrigatória.' }, { status: 400 })
    }

    const systemPrompt = getImageDirectorSystemPrompt(body.type, body.mood)

    const userMessage = [
      `Asset type: ${body.type}`,
      body.has_reference ? 'A reference image was attached by the creator — preserve its visual cues when possible.' : '',
      '',
      `Creator's description (may be in Portuguese):`,
      body.description.trim(),
    ].filter(Boolean).join('\n')

    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514'
    const requestBody = JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    let claudeRes: Response | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: requestBody,
      })
      if (claudeRes.status === 529) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
        continue
      }
      break
    }

    if (!claudeRes || !claudeRes.ok) {
      const err = claudeRes ? await claudeRes.json().catch(() => ({})) : {}
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        `Claude API retornou ${claudeRes?.status ?? 'sem resposta'}`
      return NextResponse.json({ error: message }, { status: claudeRes?.status ?? 502 })
    }

    const claudeData = await claudeRes.json() as {
      content: { type: string; text: string }[]
      usage?: { input_tokens?: number; output_tokens?: number }
    }

    const text = claudeData.content
      ?.find(c => c.type === 'text')
      ?.text?.trim() ?? ''

    if (!text) {
      return NextResponse.json({ error: 'Claude não retornou texto.' }, { status: 502 })
    }

    // Parse JSON (tolerante a code fences)
    let parsed: ImageDirectorOutput
    try {
      parsed = JSON.parse(text) as ImageDirectorOutput
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) {
        return NextResponse.json(
          { error: 'Claude retornou formato inválido.', raw: text },
          { status: 502 }
        )
      }
      parsed = JSON.parse(match[0]) as ImageDirectorOutput
    }

    if (!parsed.prompt) {
      return NextResponse.json(
        { error: 'Resposta sem prompt.', raw: text },
        { status: 502 }
      )
    }

    // Activity event — custo real do Claude sonnet calculado a partir de usage tokens
    // Preço Claude sonnet: $3/M input, $15/M output
    const inputTokens = claudeData.usage?.input_tokens ?? 0
    const outputTokens = claudeData.usage?.output_tokens ?? 0
    const realCost = (inputTokens * 3 / 1_000_000) + (outputTokens * 15 / 1_000_000)
    const costSource = (inputTokens > 0 || outputTokens > 0) ? 'real' : 'estimated'
    const cost = costSource === 'real' ? realCost : 0.005

    // ── Registra custo real para média dinâmica ──
    if (cost > 0) recordEngineCost('image-director', cost).catch(() => {})

    // ── Wallet deduction — cobra preço do CLIENTE (com margem) ──
    let walletDeducted = false
    if (walletId && clientPricePerCall > 0) {
      try {
        const txn = await spendCredits(walletId, clientPricePerCall, `Image Director (${body.type})`, {
          generationType: 'image_director',
          userId: earlyAuth?.id,
        })
        walletDeducted = txn !== null
      } catch (walletErr) {
        console.error('[/api/image-director] Wallet deduction error:', walletErr)
      }
    }

    const authUser = getAuthUser(request)
    if (authUser) {
      emitEvent({
        userId: authUser.id,
        userName: authUser.name,
        userEmail: authUser.email,
        userRole: authUser.role,
        organizationId: authUser.organizationId,
        type: 'image_director_called',
        meta: {
          cost: clientPricePerCall,
          assetType: body.type,
          extra: {
            costSource,
            claudeCostUsd: cost,
            walletDeducted,
          },
        },
      }).catch(() => {})
    }

    return NextResponse.json({
      prompt: parsed.prompt,
      name_suggestion: parsed.name_suggestion ?? '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    })
  } catch (err) {
    console.error('[/api/image-director]', err)
    const message = err instanceof Error ? err.message : 'Erro interno.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
