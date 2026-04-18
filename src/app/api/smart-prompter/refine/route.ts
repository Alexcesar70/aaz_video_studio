import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { refinePrompt } from '@/modules/smart-prompter'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    requireAuth(request)
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 })
    }

    const body = await request.json() as {
      prompt?: string
      engine?: string
      variables?: Record<string, string>
      styleProfile?: string
    }

    if (!body.prompt?.trim()) {
      return NextResponse.json({ error: 'prompt é obrigatório.' }, { status: 400 })
    }

    const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514'

    const result = await refinePrompt(
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
        prompt: body.prompt,
        engine: body.engine,
        variables: body.variables,
        styleProfile: body.styleProfile,
      },
    )

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[POST /api/smart-prompter/refine]', err)
    const msg = err instanceof Error ? err.message : 'Erro interno.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
