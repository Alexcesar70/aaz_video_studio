import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { getAuthUser } from '@/lib/auth'

/**
 * POST /api/blob-client-upload
 *
 * Handler pro client-side upload direto ao Vercel Blob (bypass do
 * limite de 4.5MB do server-side put). Usado principalmente pra
 * upload do MP4 final de episódio (pode ter centenas de MB).
 *
 * Fluxo:
 *  1. Cliente chama upload(filename, file, { handleUploadUrl: '/api/blob-client-upload' })
 *  2. @vercel/blob/client faz request pra cá pedindo um token
 *  3. Esta rota valida a sessão (só usuários autenticados)
 *  4. Retorna token assinado que o cliente usa pra upload direto no Blob
 *  5. Após o upload, @vercel/blob/client chama essa rota de novo
 *     com onUploadCompleted (útil pra persistir metadata no futuro)
 *
 * Esta rota NÃO persiste nada no Redis — apenas emite o token.
 * O caller é responsável por chamar /api/episodes/[id] com
 * action=upload_delivery e a URL retornada pra registrar a entrega.
 */

export const runtime = 'nodejs'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as HandleUploadBody
    const authUser = getAuthUser(request)

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, _clientPayload) => {
        // Só creators e admins podem fazer upload de entrega
        if (authUser.role !== 'creator' && authUser.role !== 'admin') {
          throw new Error('Access denied')
        }
        return {
          allowedContentTypes: [
            'video/mp4',
            'video/mov',
            'video/quicktime',
            'video/webm',
          ],
          // Máximo 500MB por arquivo
          maximumSizeInBytes: 500 * 1024 * 1024,
          // Encode o userId no payload pra podermos auditar depois
          tokenPayload: JSON.stringify({ userId: authUser.id }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload: _tp }) => {
        void _tp
        console.log('[blob-client-upload] completed:', blob.url)
        // Poderíamos persistir metadata aqui, mas preferimos deixar o
        // client chamar /api/episodes/[id] com a URL — fluxo mais explícito.
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao processar upload.'
    console.error('[/api/blob-client-upload]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
