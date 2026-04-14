/**
 * /api/references/[id]
 *
 *   GET    → busca um ReferenceAsset (auth: user owner ou mesmo workspace)
 *   DELETE → remove o registro. Query ?deleteBlob=1 para também apagar do Blob.
 */

import { NextRequest, NextResponse } from 'next/server'
import { del as blobDel } from '@vercel/blob'
import { getAuthUser } from '@/lib/auth'
import {
  getReferenceAsset,
  removeReferenceAsset,
  ReferenceAssetNotFoundError,
  ReferenceAssetAccessDeniedError,
  RedisReferenceAssetRepository,
  type BlobDeleter,
} from '@/modules/references'

export const dynamic = 'force-dynamic'

/**
 * Adapter `BlobDeleter` baseado em `@vercel/blob#del`. Mantido local
 * a este route handler — o módulo `references` permanece livre de
 * dependência do Vercel.
 */
const vercelBlobDeleter: BlobDeleter = {
  async delete(pathname: string): Promise<void> {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return
    await blobDel(pathname)
  },
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const repo = new RedisReferenceAssetRepository()
    const reference = await getReferenceAsset(
      { repo },
      {
        id: params.id,
        requesterUserId: user.id,
        requesterWorkspaceId: user.organizationId ?? null,
      },
    )
    return NextResponse.json({ reference })
  } catch (err) {
    if (err instanceof ReferenceAssetNotFoundError) {
      return NextResponse.json(
        { error: 'ReferenceAsset não encontrado.' },
        { status: 404 },
      )
    }
    if (err instanceof ReferenceAssetAccessDeniedError) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }
    console.error('[/api/references/:id GET]', err)
    const message = err instanceof Error ? err.message : 'Erro interno.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const deleteBlob = request.nextUrl.searchParams.get('deleteBlob') === '1'
    const repo = new RedisReferenceAssetRepository()

    await removeReferenceAsset(
      { repo, blobDeleter: vercelBlobDeleter },
      {
        id: params.id,
        requesterUserId: user.id,
        requesterWorkspaceId: user.organizationId ?? null,
        deleteBlob,
      },
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ReferenceAssetNotFoundError) {
      return NextResponse.json(
        { error: 'ReferenceAsset não encontrado.' },
        { status: 404 },
      )
    }
    if (err instanceof ReferenceAssetAccessDeniedError) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }
    console.error('[/api/references/:id DELETE]', err)
    const message = err instanceof Error ? err.message : 'Erro interno.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
