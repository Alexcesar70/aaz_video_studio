/**
 * /api/references — CRUD de ReferenceAssets.
 *
 *   POST  /api/references               → cria (body: { url, mediaType?, source, ... })
 *   GET   /api/references?mediaType=... → lista (escopo do user ou workspace)
 *
 * A rota é thin — delega tudo ao módulo `references`. Autorização:
 *   - POST requer user autenticado. A entidade é criada como pertencente
 *     a esse user no workspace dele.
 *   - GET lista apenas assets do próprio user (ou admin lista tudo — TODO).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import {
  createReferenceAsset,
  listReferenceAssets,
  InvalidReferenceAssetError,
  RedisReferenceAssetRepository,
  type ReferenceMediaType,
  type ReferenceSource,
  REFERENCE_MEDIA_TYPES,
  REFERENCE_SOURCES,
} from '@/modules/references'

export const dynamic = 'force-dynamic'

function isMediaType(v: unknown): v is ReferenceMediaType {
  return (
    typeof v === 'string' &&
    REFERENCE_MEDIA_TYPES.includes(v as ReferenceMediaType)
  )
}
function isSource(v: unknown): v is ReferenceSource {
  return (
    typeof v === 'string' && REFERENCE_SOURCES.includes(v as ReferenceSource)
  )
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null
    if (!body) {
      return NextResponse.json(
        { error: 'Request body inválido.' },
        { status: 400 },
      )
    }

    if (typeof body.url !== 'string') {
      return NextResponse.json(
        { error: 'url é obrigatório (string).' },
        { status: 400 },
      )
    }
    if (!isSource(body.source)) {
      return NextResponse.json(
        { error: `source inválido. Use um de: ${REFERENCE_SOURCES.join(', ')}` },
        { status: 400 },
      )
    }
    if (body.mediaType !== undefined && !isMediaType(body.mediaType)) {
      return NextResponse.json(
        {
          error: `mediaType inválido. Use um de: ${REFERENCE_MEDIA_TYPES.join(', ')}`,
        },
        { status: 400 },
      )
    }

    const repo = new RedisReferenceAssetRepository()
    const asset = await createReferenceAsset(
      { repo },
      {
        url: body.url,
        mediaType: body.mediaType as ReferenceMediaType | undefined,
        source: body.source,
        sourceRef: body.sourceRef as
          | { kind: 'job' | 'asset' | 'scene' | 'episode'; id: string }
          | undefined,
        pathname: typeof body.pathname === 'string' ? body.pathname : undefined,
        contentType:
          typeof body.contentType === 'string' ? body.contentType : undefined,
        sizeBytes:
          typeof body.sizeBytes === 'number' ? body.sizeBytes : undefined,
        userId: user.id,
        workspaceId: user.organizationId ?? null,
        metadata:
          body.metadata && typeof body.metadata === 'object'
            ? (body.metadata as Record<string, unknown>)
            : undefined,
      },
    )

    return NextResponse.json({ reference: asset }, { status: 201 })
  } catch (err) {
    if (err instanceof InvalidReferenceAssetError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('[/api/references POST]', err)
    const message = err instanceof Error ? err.message : 'Erro interno.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const params = request.nextUrl.searchParams
    const mediaTypeParam = params.get('mediaType')
    const sourceParam = params.get('source')
    const limitParam = params.get('limit')
    const scope = params.get('scope') // 'me' | 'workspace' | undefined

    if (mediaTypeParam && !isMediaType(mediaTypeParam)) {
      return NextResponse.json(
        { error: 'mediaType inválido.' },
        { status: 400 },
      )
    }
    if (sourceParam && !isSource(sourceParam)) {
      return NextResponse.json({ error: 'source inválido.' }, { status: 400 })
    }

    const limit = limitParam ? Math.min(Number(limitParam) || 50, 200) : 50

    const repo = new RedisReferenceAssetRepository()
    const filter =
      scope === 'workspace'
        ? { workspaceId: user.organizationId ?? null }
        : { userId: user.id }

    const references = await listReferenceAssets({ repo }, {
      ...filter,
      mediaType: (mediaTypeParam ?? undefined) as
        | ReferenceMediaType
        | undefined,
      source: (sourceParam ?? undefined) as ReferenceSource | undefined,
      limit,
    })

    return NextResponse.json({ references })
  } catch (err) {
    console.error('[/api/references GET]', err)
    const message = err instanceof Error ? err.message : 'Erro interno.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
