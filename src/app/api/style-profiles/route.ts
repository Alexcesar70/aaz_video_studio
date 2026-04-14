import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import {
  listStyleProfilesVisibleTo,
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
