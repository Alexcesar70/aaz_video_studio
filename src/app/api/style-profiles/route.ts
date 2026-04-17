import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireAuth, AuthError } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import {
  listStyleProfilesVisibleTo,
  upsertStyleProfile,
  RedisStyleProfileRepository,
} from '@/modules/library'

/**
 * GET /api/style-profiles
 *
 * Lista StyleProfiles visíveis ao usuário atual:
 *   - Presets globais (todos os workspaces veem)
 *   - Profiles do workspace do user (customizações/forks)
 *
 * Consumido pelo seletor de estilo no Studio e Atelier.
 * Retorna summary sem o promptBlock completo (que pode ser grande).
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
    }

    const repo = new RedisStyleProfileRepository()
    const profiles = await listStyleProfilesVisibleTo(
      { repo },
      authUser.organizationId ?? null,
    )

    const summary = profiles.map((p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description,
      tags: p.tags,
      isOfficial: p.isOfficial,
      version: p.version,
      scope: p.workspaceId === null ? 'global' : 'workspace',
      referenceCount: p.referenceUrls?.length ?? 0,
      updatedAt: p.updatedAt,
    }))

    // Oficiais primeiro, depois por nome
    summary.sort((a, b) => {
      if (a.isOfficial !== b.isOfficial) return a.isOfficial ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({ profiles: summary })
  } catch (err) {
    console.error('[GET /api/style-profiles]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}

/**
 * POST /api/style-profiles
 *
 * Cria um StyleProfile workspace-scoped.
 *
 * Body:
 *   { slug, name, promptBlock, description?, referenceUrls?, tags? }
 *
 * O workspaceId é carimbado automaticamente do user autenticado.
 * Se o slug já existir no workspace, incrementa version (upsert).
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
      name?: string
      promptBlock?: string
      description?: string
      referenceUrls?: string[]
      tags?: string[]
    }

    if (!body.slug?.trim() || !body.name?.trim() || !body.promptBlock?.trim()) {
      return NextResponse.json(
        { error: 'slug, name e promptBlock são obrigatórios.' },
        { status: 400 },
      )
    }

    const repo = new RedisStyleProfileRepository()
    const result = await upsertStyleProfile(
      { repo },
      {
        slug: body.slug.trim(),
        name: body.name.trim(),
        promptBlock: body.promptBlock,
        description: body.description?.trim(),
        referenceUrls: body.referenceUrls,
        tags: body.tags,
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
    const msg = err instanceof Error ? err.message : 'Erro ao criar style profile.'
    console.error('[POST /api/style-profiles]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
