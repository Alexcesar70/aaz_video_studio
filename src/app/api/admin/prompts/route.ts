import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import {
  listPromptTemplates,
  RedisPromptTemplateRepository,
  PROMPT_TEMPLATE_KINDS,
  type PromptTemplateKind,
} from '@/modules/prompts'

/**
 * GET /api/admin/prompts
 * Lista prompt templates (global + overrides por workspace).
 *
 * Query params:
 *   - kind: filtra por tipo
 *   - workspaceId: filtra por escopo (vazio = global, omitido = todos)
 */
export async function GET(request: NextRequest) {
  try {
    requireSuperAdmin(request)

    const url = new URL(request.url)
    const kindParam = url.searchParams.get('kind')
    const wsParam = url.searchParams.get('workspaceId')

    const filter: { kind?: PromptTemplateKind; workspaceId?: string | null } = {}

    if (kindParam) {
      if (!PROMPT_TEMPLATE_KINDS.includes(kindParam as PromptTemplateKind)) {
        return NextResponse.json(
          { error: `kind inválido: ${kindParam}` },
          { status: 400 },
        )
      }
      filter.kind = kindParam as PromptTemplateKind
    }

    if (wsParam !== null) {
      filter.workspaceId = wsParam === '' ? null : wsParam
    }

    const repo = new RedisPromptTemplateRepository()
    const templates = await listPromptTemplates({ repo }, filter)

    // Retorna sem o content completo (é grande) — só metadados.
    const summary = templates.map((t) => ({
      slug: t.slug,
      kind: t.kind,
      description: t.description,
      version: t.version,
      workspaceId: t.workspaceId,
      contentLength: t.content.length,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }))

    return NextResponse.json({ templates: summary })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[GET /api/admin/prompts]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
