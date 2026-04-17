import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireAuth, AuthError } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import {
  upsertStyleProfile,
  RedisStyleProfileRepository,
} from '@/modules/library'

/**
 * GET /api/style-profiles/[slug]
 *
 * Retorna o StyleProfile completo (incluindo promptBlock).
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

    const repo = new RedisStyleProfileRepository()
    const profile = await repo.findBySlug(
      params.slug,
      authUser.organizationId ?? null,
    )

    if (!profile) {
      return NextResponse.json({ error: 'Style profile não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ profile })
  } catch (err) {
    console.error('[GET /api/style-profiles/[slug]]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

/**
 * PUT /api/style-profiles/[slug]
 *
 * Atualiza um StyleProfile do workspace do user. Incrementa version.
 * Não permite editar presets globais (isOfficial) — só workspace-scoped.
 *
 * Body:
 *   { name?, promptBlock?, description?, referenceUrls?, tags? }
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

    const repo = new RedisStyleProfileRepository()
    const existing = await repo.findBySlugExact(params.slug, user.organizationId)
    if (!existing) {
      return NextResponse.json(
        { error: `Style profile "${params.slug}" não encontrado no seu workspace.` },
        { status: 404 },
      )
    }
    if (existing.isOfficial) {
      return NextResponse.json(
        { error: 'Não é possível editar presets oficiais. Faça um fork.' },
        { status: 403 },
      )
    }

    const body = await request.json() as {
      name?: string
      promptBlock?: string
      description?: string
      referenceUrls?: string[]
      tags?: string[]
    }

    const result = await upsertStyleProfile(
      { repo },
      {
        slug: params.slug,
        name: body.name?.trim() ?? existing.name,
        promptBlock: body.promptBlock ?? existing.promptBlock,
        description: body.description?.trim() ?? existing.description,
        referenceUrls: body.referenceUrls ?? existing.referenceUrls,
        tags: body.tags ?? existing.tags,
        workspaceId: user.organizationId,
        isOfficial: false,
        updatedBy: user.id,
      },
    )

    return NextResponse.json({
      ok: true,
      profile: result.profile,
      action: result.action,
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const msg = err instanceof Error ? err.message : 'Erro ao atualizar.'
    console.error('[PUT /api/style-profiles/[slug]]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

/**
 * DELETE /api/style-profiles/[slug]
 *
 * Remove um StyleProfile workspace-scoped.
 * Não permite remover presets globais (isOfficial).
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

    const repo = new RedisStyleProfileRepository()
    const existing = await repo.findBySlugExact(params.slug, user.organizationId)
    if (!existing) {
      return NextResponse.json(
        { error: `Style profile "${params.slug}" não encontrado no seu workspace.` },
        { status: 404 },
      )
    }
    if (existing.isOfficial) {
      return NextResponse.json(
        { error: 'Não é possível remover presets oficiais.' },
        { status: 403 },
      )
    }

    await repo.remove(params.slug, user.organizationId)

    return NextResponse.json({ ok: true, deleted: params.slug })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[DELETE /api/style-profiles/[slug]]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
