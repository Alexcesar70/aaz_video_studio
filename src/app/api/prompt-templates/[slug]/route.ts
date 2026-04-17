import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireAuth, AuthError } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import {
  upsertPromptTemplate,
  RedisPromptTemplateRepository,
  PROMPT_TEMPLATE_KINDS,
  type PromptTemplateKind,
} from '@/modules/prompts'

/**
 * GET /api/prompt-templates/[slug]
 *
 * Retorna o PromptTemplate completo (incluindo content).
 * Resolve com precedência: workspace override → global.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const authUser = getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
    }

    const repo = new RedisPromptTemplateRepository()
    const template = await repo.findBySlug(
      params.slug,
      authUser.organizationId ?? null,
    )

    if (!template) {
      return NextResponse.json({ error: 'Prompt template não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ template })
  } catch (err) {
    console.error('[GET /api/prompt-templates/[slug]]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

/**
 * PUT /api/prompt-templates/[slug]
 *
 * Atualiza um PromptTemplate workspace-scoped. Incrementa version.
 *
 * Body:
 *   { content?, description?, kind? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const user = requireAuth(request)
    if (!hasPermission(user.permissions, user.role, PERMISSIONS.MANAGE_ASSETS)) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Workspace não definido.' }, { status: 400 })
    }

    const repo = new RedisPromptTemplateRepository()
    const existing = await repo.findBySlugExact(params.slug, user.organizationId)
    if (!existing) {
      return NextResponse.json(
        { error: `Prompt template "${params.slug}" não encontrado no seu workspace.` },
        { status: 404 },
      )
    }

    const body = await request.json() as {
      content?: string
      description?: string
      kind?: string
    }

    const kind = body.kind as PromptTemplateKind | undefined
    if (kind && !PROMPT_TEMPLATE_KINDS.includes(kind)) {
      return NextResponse.json(
        { error: `kind inválido. Válidos: ${PROMPT_TEMPLATE_KINDS.join(', ')}` },
        { status: 400 },
      )
    }

    const result = await upsertPromptTemplate(
      { repo },
      {
        slug: params.slug,
        kind: kind ?? existing.kind,
        content: body.content ?? existing.content,
        description: body.description?.trim() ?? existing.description,
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
    const msg = err instanceof Error ? err.message : 'Erro ao atualizar.'
    console.error('[PUT /api/prompt-templates/[slug]]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

/**
 * DELETE /api/prompt-templates/[slug]
 *
 * Remove um PromptTemplate workspace-scoped.
 * Não permite remover templates globais.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    const user = requireAuth(request)
    if (!hasPermission(user.permissions, user.role, PERMISSIONS.MANAGE_ASSETS)) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }
    if (!user.organizationId) {
      return NextResponse.json({ error: 'Workspace não definido.' }, { status: 400 })
    }

    const repo = new RedisPromptTemplateRepository()
    const existing = await repo.findBySlugExact(params.slug, user.organizationId)
    if (!existing) {
      return NextResponse.json(
        { error: `Prompt template "${params.slug}" não encontrado no seu workspace.` },
        { status: 404 },
      )
    }

    await repo.remove(params.slug, user.organizationId)

    return NextResponse.json({ ok: true, deleted: params.slug })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[DELETE /api/prompt-templates/[slug]]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
