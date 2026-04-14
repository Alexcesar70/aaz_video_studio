import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import {
  listStyleProfiles,
  RedisStyleProfileRepository,
} from '@/modules/library'

/**
 * GET /api/admin/style-profiles
 * Lista todos os StyleProfiles (global + overrides por workspace).
 *
 * Query params:
 *   - workspaceId: '' → só globais; '<id>' → só overrides desse ws;
 *                  omitido → todos.
 *   - isOfficial: 'true' | 'false' → filtra presets oficiais vs custom.
 *   - tag: string → filtra por tag.
 */
export async function GET(request: NextRequest) {
  try {
    requireSuperAdmin(request)

    const url = new URL(request.url)
    const wsParam = url.searchParams.get('workspaceId')
    const officialParam = url.searchParams.get('isOfficial')
    const tag = url.searchParams.get('tag') ?? undefined

    const filter: {
      workspaceId?: string | null
      isOfficial?: boolean
      tag?: string
    } = {}

    if (wsParam !== null) {
      filter.workspaceId = wsParam === '' ? null : wsParam
    }
    if (officialParam === 'true') filter.isOfficial = true
    if (officialParam === 'false') filter.isOfficial = false
    if (tag) filter.tag = tag

    const repo = new RedisStyleProfileRepository()
    const profiles = await listStyleProfiles({ repo }, filter)

    // Retorna summary — promptBlock pode ser grande
    const summary = profiles.map((p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description,
      tags: p.tags,
      isOfficial: p.isOfficial,
      version: p.version,
      workspaceId: p.workspaceId,
      promptBlockLength: p.promptBlock.length,
      referenceCount: p.referenceUrls?.length ?? 0,
      forkedFromId: p.forkedFromId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))

    return NextResponse.json({ profiles: summary })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[GET /api/admin/style-profiles]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
