import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireAuth, AuthError } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { checkWalletBalance, spendCredits } from '@/lib/wallet'
import { getClientPrice } from '@/lib/pricing'
import { emitEvent } from '@/lib/activity'
import {
  resolveThumbnailDirectorSystem,
  RedisPromptTemplateRepository,
} from '@/modules/prompts'

/**
 * POST /api/thumbnail-director
 *
 * Gera um prompt otimizado pra thumbnail usando Claude.
 *
 * Body:
 *   {
 *     title: string,           — título do vídeo
 *     platform: string,        — youtube | tiktok | instagram
 *     niche?: string,          — categoria/nicho do canal
 *     audience?: string,       — público-alvo
 *     style_hint?: string,     — "close-up com texto grande" etc
 *     reference_urls?: string[], — thumbnails do canal pra manter estilo
 *     brand_colors?: string[], — cores da marca
 *   }
 *
 * Response:
 *   { prompt: string, thumbnailPrompt: string }
 */
export async function POST(request: NextRequest) {
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 })
    }

    const user = requireAuth(request)
    if (!hasPermission(user.permissions, user.role, PERMISSIONS.GENERATE_IMAGE)) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const body = await request.json() as {
      title?: string
      platform?: string
      niche?: string
      audience?: string
      style_hint?: string
      reference_urls?: string[]
      brand_colors?: string[]
    }

    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'title é obrigatório.' }, { status: 400 })
    }

    const clientPrice = await getClientPrice('thumbnail-director', 0.01)
    if (user.organizationId) {
      const walletCheck = await checkWalletBalance(user.id, user.organizationId, clientPrice)
      if (!walletCheck.allowed) {
        return NextResponse.json({ error: walletCheck.reason }, { status: 402 })
      }
    }

    const resolved = await resolveThumbnailDirectorSystem(
      { repo: new RedisPromptTemplateRepository() },
      { workspaceId: user.organizationId ?? null },
    )

    const userMessage = [
      `Video title: ${body.title}`,
      `Platform: ${body.platform ?? 'youtube'}`,
      body.niche ? `Niche/category: ${body.niche}` : '',
      body.audience ? `Target audience: ${body.audience}` : '',
      body.style_hint ? `Creator's style preference: ${body.style_hint}` : '',
      body.brand_colors?.length ? `Brand colors: ${body.brand_colors.join(', ')}` : '',
      body.reference_urls?.length ? `Reference thumbnails from this channel (maintain visual consistency): ${body.reference_urls.join(', ')}` : '',
      '',
      'Generate a detailed image prompt for this thumbnail.',
    ].filter(Boolean).join('\n')

    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514'

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: resolved.prompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({})) as { error?: { message?: string } }
      return NextResponse.json(
        { error: err?.error?.message ?? `Claude API retornou ${claudeRes.status}` },
        { status: claudeRes.status },
      )
    }

    const claudeData = await claudeRes.json() as {
      content: { type: string; text: string }[]
      usage?: { input_tokens?: number; output_tokens?: number }
    }

    const thumbnailPrompt = claudeData.content?.find(c => c.type === 'text')?.text?.trim()
    if (!thumbnailPrompt) {
      return NextResponse.json({ error: 'ThumbnailDirector não retornou prompt.' }, { status: 502 })
    }

    if (user.organizationId) {
      const walletId = (await checkWalletBalance(user.id, user.organizationId, 0)).walletId
      if (walletId && clientPrice > 0) {
        spendCredits(walletId, clientPrice, 'Thumbnail Director', {
          generationType: 'thumbnail_director',
          userId: user.id,
        }).catch(() => {})
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
        type: 'thumbnail_director_called',
        meta: {
          cost: clientPrice,
          extra: {
            platform: body.platform,
            promptSource: resolved.source,
            promptVersion: resolved.version,
          },
        },
      }).catch(() => {})
    }

    return NextResponse.json({
      thumbnailPrompt,
      promptSource: resolved.source,
      platform: body.platform ?? 'youtube',
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[POST /api/thumbnail-director]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
