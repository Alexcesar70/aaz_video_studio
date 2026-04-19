import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { getAuthUser } from '@/lib/auth'

/**
 * POST /api/workflow/upload
 *
 * Token issuer pra client-side upload direto ao Vercel Blob, usado pelos
 * nós do Workflow (ImageNode, VideoNode, ReferenceNode) pra subir avatar,
 * vídeo de referência, start frame, etc.
 *
 * Diferencial vs `/api/blob-upload` (server-side put):
 *   - Sem limite de 4.5MB (body serverless) — aceita até 50MB
 *   - Passa pelo Blob direto do browser, apenas o token vem daqui
 *
 * Aceita imagens e vídeos. Qualquer usuário autenticado pode usar.
 */

export const runtime = 'nodejs'

const ALLOWED_CONTENT_TYPES = [
  // imagens
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  // vídeos
  'video/mp4', 'video/mov', 'video/quicktime', 'video/webm', 'video/x-m4v',
  // áudio (uso pra referência futura)
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'audio/mp4',
]

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadBody
    const authUser = getAuthUser(request)

    if (!authUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        maximumSizeInBytes: MAX_BYTES,
        tokenPayload: JSON.stringify({ userId: authUser.id }),
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log('[/api/workflow/upload] completed:', blob.url)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao gerar token de upload.'
    console.error('[/api/workflow/upload]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
