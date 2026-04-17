/**
 * POST /api/generate
 *
 * Controller — responsável APENAS por:
 * 1. Extrair dados do request HTTP
 * 2. Delegar ao use case (síncrono) OU enfileirar como Job (assíncrono)
 * 3. Mapear resultado/erro para resposta HTTP
 *
 * Zero business logic. Zero acesso a providers.
 *
 * Modo síncrono (padrão): chama `generateVideo` inline e retorna
 * `VideoGenerationResult`. É o comportamento histórico.
 *
 * Modo assíncrono (flag USE_ASYNC_GENERATION ligada): enfileira o
 * job via `enqueueJob` e retorna imediatamente `{ jobId, status: 'queued' }`.
 * O frontend consulta `GET /api/jobs/[id]` para polling.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import {
  ValidationError,
  PermissionError,
  InsufficientBalanceError,
  ProviderError,
} from '@/domain/videoGeneration'
import {
  enqueueJob,
  RedisJobRepository,
} from '@/modules/jobs'
import { createProductionJobRunner } from '@/inngest/runner'
import type { VideoGenerationJobInput } from '@/inngest/functions/videoGeneration'
import { reportError } from '@/lib/errorReporter'

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

    const videoRequest = {
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
    }

    const userSnapshot = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      permissions: user.permissions,
    }

    const repo = new RedisJobRepository()
    const runner = createProductionJobRunner()

    const jobInput: VideoGenerationJobInput = {
      request: videoRequest,
      user: userSnapshot,
    }

    const job = await enqueueJob(
      { repo, runner },
      {
        kind: 'video_generation',
        input: jobInput,
        userId: user.id,
        workspaceId: user.organizationId ?? null,
        metadata: {
          engineId: videoRequest.engineId,
          duration: videoRequest.duration,
        },
      },
    )

    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status,
        async: true,
      },
      { status: 202 },
    )
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

    reportError(err, {
      tags: { feature: 'video_generation', stage: 'route_handler' },
    })
    console.error('[/api/generate]', err)
    const message = err instanceof Error ? err.message : 'Erro interno.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
