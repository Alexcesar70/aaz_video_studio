/**
 * POST /api/generate
 *
 * Controller — responsável APENAS por:
 * 1. Extrair dados do request HTTP
 * 2. Delegar ao use case
 * 3. Mapear resultado/erro para resposta HTTP
 *
 * Zero business logic. Zero acesso a providers.
 * Toda lógica está em src/usecases/video/generateVideo.ts
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createVideoProvider } from '@/providers/segmind'
import { createVideoStorage } from '@/providers/blobStorage'
import { generateVideo } from '@/usecases/video/generateVideo'
import {
  ValidationError,
  PermissionError,
  InsufficientBalanceError,
  ProviderError,
} from '@/domain/videoGeneration'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Request body inválido.' }, { status: 413 })
    }

    const provider = createVideoProvider()
    const storage = createVideoStorage()

    const result = await generateVideo(provider, storage, {
      request: {
        prompt: body.prompt,
        duration: body.duration,
        aspectRatio: body.aspect_ratio,
        resolution: body.resolution,
        engineId: body.engineId,
        generateAudio: body.generate_audio,
        mode: body.mode,
        referenceImages: body.reference_images,
        referenceVideos: body.reference_videos,
        referenceAudios: body.reference_audios,
        firstFrameUrl: body.first_frame_url,
        lastFrameUrl: body.last_frame_url,
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        permissions: user.permissions,
      },
    })

    return NextResponse.json(result)

  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof PermissionError) {
      return NextResponse.json({ error: err.message }, { status: 403 })
    }
    if (err instanceof InsufficientBalanceError) {
      return NextResponse.json({
        error: err.message,
        balance: err.balance,
        required: err.required,
      }, { status: 402 })
    }
    if (err instanceof ProviderError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode })
    }

    console.error('[/api/generate]', err)
    const message = err instanceof Error ? err.message : 'Erro interno.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
