/**
 * Inngest function — consome eventos `aaz/job.video_generation.requested`
 * e executa o use case `generateVideo` em background.
 *
 * Fluxo:
 *   1. markRunning(jobId) — transição queued → running
 *   2. generateVideo(...) — mesma pipeline síncrona: Segmind → Blob →
 *      wallet → evento de atividade
 *   3. markCompleted(jobId, result) OU markFailed(jobId, error)
 *
 * Inngest garante durabilidade: se o processo crashar no meio, a função
 * é reexecutada do último `step.run` bem-sucedido. Usamos múltiplos
 * steps para evitar refazer a cobrança da wallet ou reupload no retry.
 *
 * Ref: https://www.inngest.com/docs/functions
 */

import type {
  VideoGenerationRequest,
  VideoGenerationResult,
} from '@/domain/videoGeneration'
import { generateVideo } from '@/usecases/video/generateVideo'
import { createVideoProvider } from '@/providers/segmind'
import { createVideoStorage } from '@/providers/blobStorage'
import {
  RedisJobRepository,
  markRunning,
  markCompleted,
  markFailed,
} from '@/modules/jobs'
import { inngest } from '../client'
import { JOB_EVENT_NAMES } from '../events'

export interface VideoGenerationJobInput {
  request: VideoGenerationRequest
  user: {
    id: string
    name: string
    email: string
    role: string
    organizationId?: string
    permissions?: string[]
  }
}

/**
 * Função pura para executar o trabalho. Exportada para que testes
 * possam invocá-la diretamente com mocks de provider/storage sem
 * depender da infra do Inngest.
 */
export async function executeVideoGenerationJob(
  input: VideoGenerationJobInput,
): Promise<VideoGenerationResult> {
  const provider = createVideoProvider()
  const storage = createVideoStorage()
  return generateVideo(provider, storage, {
    request: input.request,
    user: input.user,
  })
}

export const videoGenerationJobFunction = inngest.createFunction(
  {
    id: 'video-generation-job',
    name: 'Video Generation Job',
    retries: 2, // 1 execução + 2 retries = 3 tentativas total
    triggers: [{ event: JOB_EVENT_NAMES.video_generation }],
  },
  async ({ event, step, logger }) => {
    const { jobId, input } = event.data as {
      jobId: string
      input: VideoGenerationJobInput
    }

    logger.info('[video-generation-job] start', { jobId })

    const repo = new RedisJobRepository()

    await step.run('mark-running', async () => {
      await markRunning({ repo }, { id: jobId })
    })

    try {
      const result = await step.run('generate-video', async () => {
        return executeVideoGenerationJob(input)
      })

      await step.run('mark-completed', async () => {
        await markCompleted({ repo }, { id: jobId, output: result })
      })

      logger.info('[video-generation-job] done', {
        jobId,
        videoUrl: result.videoUrl,
      })
      return { jobId, status: 'completed' as const }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      const code =
        err instanceof Error && err.name ? err.name : 'ProviderError'
      logger.error('[video-generation-job] failed', { jobId, message })

      // Best-effort: marca failed mesmo se Inngest for re-tentar (no pior
      // caso o retry sobrescreve). Se markFailed lançar, propagamos para
      // Inngest tratar o retry.
      await step.run('mark-failed', async () => {
        await markFailed({ repo }, {
          id: jobId,
          error: { message, code },
        })
      })
      throw err
    }
  },
)
