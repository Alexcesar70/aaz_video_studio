import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireAuth, AuthError } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import {
  listPromptTemplates,
  upsertPromptTemplate,
  RedisPromptTemplateRepository,
  PROMPT_TEMPLATE_KINDS,
  type PromptTemplateKind,
} from '@/modules/prompts'

/**
 * GET /api/prompt-templates
 *
 * Lista PromptTemplates visíveis ao user: globais + workspace overrides.
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
    }

    const repo = new RedisPromptTemplateRepository()
    const wsId = authUser.organizationId ?? null

    const [globals, overrides] = await Promise.all([
      listPromptTemplates({ repo }, { workspaceId: null }),
      wsId ? listPromptTemplates({ repo }, { workspaceId: wsId }) : Promise.resolve([]),
    ])

    const overrideMap = new Map(overrides.map(t => [t.slug, t]))
    const merged = globals.map(g => overrideMap.get(g.slug) ?? g)
    for (const o of overrides) {
      if (!globals.find(g => g.slug === o.slug)) merged.push(o)
    }

    const summary = merged.map(t => ({
      slug: t.slug,
      kind: t.kind,
      description: t.description,
      version: t.version,
      scope: t.workspaceId === null ? 'global' : 'workspace',
      updatedAt: t.updatedAt,
    }))

    return NextResponse.json({ templates: summary })
  } catch (err) {
    console.error('[GET /api/prompt-templates]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

/**
 * POST /api/prompt-templates
 *
 * Cria um PromptTemplate workspace-scoped (override ou novo).
 *
 * Body:
 *   { slug, kind, content, description? }
 */
export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request)
    if (!hasPermission(user.permissions, user.role, PERMISSIONS.MANAGE_ASSETS)) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Workspace não definido.' }, { status: 400 })
    }

    const body = await request.json() as {
      slug?: string
      kind?: string
      content?: string
      description?: string
    }

    if (!body.slug?.trim() || !body.kind || !body.content?.trim()) {
      return NextResponse.json(
        { error: 'slug, kind e content são obrigatórios.' },
        { status: 400 },
      )
    }
    if (!PROMPT_TEMPLATE_KINDS.includes(body.kind as PromptTemplateKind)) {
      return NextResponse.json(
        { error: `kind inválido. Válidos: ${PROMPT_TEMPLATE_KINDS.join(', ')}` },
        { status: 400 },
      )
    }

    const repo = new RedisPromptTemplateRepository()
    const result = await upsertPromptTemplate(
      { repo },
      {
        slug: body.slug.trim(),
        kind: body.kind as PromptTemplateKind,
        content: body.content,
        description: body.description?.trim(),
        workspaceId: user.organizationId,
        updatedBy: user.id,
      },
    )

    return NextResponse.json({
      ok: true,
      template: result.template,
      action: result.action,
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const msg = err instanceof Error ? err.message : 'Erro ao criar prompt template.'
    console.error('[POST /api/prompt-templates]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
