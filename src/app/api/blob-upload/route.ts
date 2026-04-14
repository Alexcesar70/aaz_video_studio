import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getAuthUser } from '@/lib/auth'
import { isFeatureEnabled } from '@/lib/featureFlags'
import {
  createReferenceAsset,
  inferMediaType,
  RedisReferenceAssetRepository,
  type ReferenceMediaType,
} from '@/modules/references'

/**
 * POST /api/blob-upload
 * Recebe um arquivo (multipart/form-data) e faz upload para o Vercel Blob.
 * Retorna a URL pública para uso em reference_images/reference_videos/reference_audios.
 *
 * Body size limit é gerenciado pela Vercel (~4.5MB). Para arquivos maiores,
 * usar client-side upload direto ao Blob (não implementado ainda).
 *
 * M2-PR4: quando a flag USE_REFERENCE_ASSETS está ligada para o user
 * autenticado, o upload também é registrado como ReferenceAsset no
 * módulo `references`. A resposta ganha `referenceId` — o client pode
 * usá-lo para exibir o item no picker de histórico sem re-fetch.
 *
 * A flag OFF preserva 100% o contrato legado: response é só `{ url, pathname }`.
 */

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'BLOB_READ_WRITE_TOKEN não configurado.' },
        { status: 500 }
      )
    }

    const formData = await request.formData().catch(() => null)
    if (!formData) {
      return NextResponse.json({ error: 'Body inválido. Envie como multipart/form-data.' }, { status: 400 })
    }

    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado (campo "file").' }, { status: 400 })
    }

    // Extrai extensão do nome ou do mime type
    const nameParts = file.name?.split('.') ?? []
    let ext = nameParts.length > 1 ? nameParts.pop() : ''
    if (!ext && file.type) {
      const mimeExt = file.type.split('/')[1]
      ext = mimeExt || 'bin'
    }
    if (!ext) ext = 'bin'

    const pathname = `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const blob = await put(pathname, file, {
      access: 'public',
      contentType: file.type || 'application/octet-stream',
      addRandomSuffix: false,
    })

    // ── M2-PR4: auto-registro como ReferenceAsset ──
    const user = getAuthUser(request)
    const autoRegister =
      !!user &&
      isFeatureEnabled('USE_REFERENCE_ASSETS', {
        userId: user.id,
        workspaceId: user.organizationId,
      })

    let referenceId: string | undefined
    if (autoRegister) {
      const mediaType =
        (formData.get('mediaType') as ReferenceMediaType | null) ??
        inferMediaType({ contentType: file.type, url: blob.url })

      if (mediaType) {
        try {
          const repo = new RedisReferenceAssetRepository()
          const ref = await createReferenceAsset(
            { repo },
            {
              url: blob.url,
              pathname: blob.pathname,
              mediaType,
              contentType: file.type || undefined,
              sizeBytes: file.size,
              source: 'upload',
              userId: user.id,
              workspaceId: user.organizationId ?? null,
              metadata: {
                originalName: file.name || undefined,
              },
            },
          )
          referenceId = ref.id
        } catch (err) {
          // Best-effort: upload já concluiu. Um erro aqui não impede
          // o cliente de usar a URL. Logamos para investigação.
          console.error('[/api/blob-upload] auto-register failed', err)
        }
      }
    }

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      referenceId,
    })
  } catch (err) {
    console.error('[/api/blob-upload]', err)
    const message = err instanceof Error ? err.message : 'Erro ao fazer upload.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
