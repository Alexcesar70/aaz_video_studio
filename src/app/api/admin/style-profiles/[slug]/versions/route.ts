/**
 * GET /api/admin/style-profiles/[slug]/versions
 *
 * Retorna o histórico completo de versões de um StyleProfile em ordem
 * desc (corrente primeiro, depois versões arquivadas).
 *
 * Query params:
 *   - workspaceId: '' → escopo global; '<id>' → workspace-owned;
 *                  omitido → tenta global por padrão.
 *
 * Response: { versions: StyleProfile[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import {
  getStyleProfileVersions,
  RedisStyleProfileRepository,
} from '@/modules/library'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  try {
    requireSuperAdmin(request)

    const url = new URL(request.url)
    const wsParam = url.searchParams.get('workspaceId')
    const workspaceId: string | null =
      wsParam === null ? null : wsParam === '' ? null : wsParam

    const repo = new RedisStyleProfileRepository()
    const versions = await getStyleProfileVersions(
      { repo },
      { slug: params.slug, workspaceId },
    )

    if (versions.length === 0) {
      return NextResponse.json(
        { error: 'StyleProfile não encontrado.' },
        { status: 404 },
      )
    }

    return NextResponse.json({ versions })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[/api/admin/style-profiles/:slug/versions]', err)
    const message = err instanceof Error ? err.message : 'Erro interno.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
