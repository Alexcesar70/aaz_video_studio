import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { chat, type SpielbergMode } from '@/modules/spielberg'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request)
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 })
    }

    const body = await request.json() as {
      mode?: string
      message?: string
      history?: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>
      variables?: Array<{ key: string; value: string; source: string; category: string }>
      context?: Record<string, unknown>
    }

    if (!body.mode || !body.message?.trim()) {
      return NextResponse.json({ error: 'mode e message são obrigatórios.' }, { status: 400 })
    }

    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514'

    const result = await chat(
      {
        callAI: async (system, messages) => {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': anthropicKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({ model, max_tokens: 2048, system, messages }),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
            throw new Error(err?.error?.message ?? `Claude ${res.status}`)
          }
          const data = await res.json() as { content: { type: string; text: string }[] }
          return data.content?.find(c => c.type === 'text')?.text ?? ''
        },
      },
      {
        mode: body.mode as SpielbergMode,
        userMessage: body.message,
        history: body.history ?? [],
        variables: (body.variables ?? []) as Array<{ key: string; value: string; source: 'user' | 'spielberg'; category: 'hard' | 'soft' }>,
        context: { ...body.context, userId: user.id, workspaceId: user.organizationId },
      },
    )

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[POST /api/spielberg/chat]', err)
    const msg = err instanceof Error ? err.message : 'Erro interno.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
