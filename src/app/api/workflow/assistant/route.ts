import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'

/**
 * POST /api/workflow/assistant
 *
 * Assistant genérico usado pelo AssistantNode do Workflow — equivale
 * ao nó "Assistant" do Freepik Spaces. Chama Claude via REST e retorna
 * texto livre ou lista estruturada.
 *
 * Body:
 *   {
 *     prompt: string,
 *     modelId?: string,     // default: claude-sonnet
 *     outputFormat?: 'text' | 'list',
 *     systemHint?: string,  // instrução opcional injetada no system
 *   }
 *
 * Response:
 *   { text: string, list?: string[], modelId: string }
 */

const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929'

const ALLOWED_MODELS: Record<string, string> = {
  'claude-opus': 'claude-opus-4-1-20250805',
  'claude-sonnet': 'claude-sonnet-4-5-20250929',
  'claude-haiku': 'claude-haiku-4-5-20251001',
}

function resolveModel(modelId: string | undefined): string {
  if (!modelId) return DEFAULT_MODEL
  return ALLOWED_MODELS[modelId] ?? DEFAULT_MODEL
}

/**
 * Parser best-effort de lista: pega linhas não-vazias, remove
 * bullets/numerações de prefixo comuns ("- ", "1. ", "* "). Usado
 * quando outputFormat='list'.
 */
function parseAsList(text: string): string[] {
  return text
    .split('\n')
    .map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
    .filter(l => l.length > 0)
}

export async function POST(request: NextRequest) {
  try {
    requireAuth(request)

    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 })
    }

    const body = await request.json().catch(() => null) as {
      prompt?: string
      modelId?: string
      outputFormat?: 'text' | 'list'
      systemHint?: string
    } | null

    if (!body?.prompt?.trim()) {
      return NextResponse.json({ error: 'prompt é obrigatório.' }, { status: 400 })
    }

    const model = resolveModel(body.modelId)
    const outputFormat = body.outputFormat ?? 'text'

    const systemParts: string[] = [
      'Você é um assistente criativo dentro de um canvas de workflow.',
      'Responda de forma direta, útil e concisa, sem preâmbulos.',
    ]
    if (outputFormat === 'list') {
      systemParts.push('Responda como uma lista — um item por linha, sem numeração.')
    }
    if (body.systemHint) systemParts.push(body.systemHint)
    const system = systemParts.join(' ')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system,
        messages: [{ role: 'user', content: body.prompt.trim() }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return NextResponse.json(
        { error: `Claude API falhou (${res.status}): ${errText.slice(0, 300)}` },
        { status: 502 },
      )
    }

    const payload = await res.json() as {
      content?: Array<{ type: string; text?: string }>
    }
    const text = payload.content
      ?.filter(p => p.type === 'text')
      .map(p => p.text ?? '')
      .join('')
      .trim() ?? ''

    const list = outputFormat === 'list' ? parseAsList(text) : undefined

    return NextResponse.json({ text, list, modelId: body.modelId ?? 'claude-sonnet' })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : 'Erro interno.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
