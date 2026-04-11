import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

/**
 * POST /api/blob-upload
 * Recebe um arquivo (multipart/form-data) e faz upload para o Vercel Blob.
 * Retorna a URL pública para uso em reference_images/reference_videos/reference_audios.
 *
 * Body size limit é gerenciado pela Vercel (~4.5MB). Para arquivos maiores,
 * usar client-side upload direto ao Blob (não implementado ainda).
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

    return NextResponse.json({ url: blob.url, pathname: blob.pathname })
  } catch (err) {
    console.error('[/api/blob-upload]', err)
    const message = err instanceof Error ? err.message : 'Erro ao fazer upload.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
