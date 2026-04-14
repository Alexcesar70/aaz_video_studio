/**
 * GET /api/jobs/[id]
 *
 * Controller — delega ao use case `getJob` do módulo `jobs`.
 * Usado pelo frontend para polling quando a flag USE_ASYNC_GENERATION
 * está ligada e /api/generate retorna { jobId }.
 *
 * Autorização: o job só é retornado se pertence ao user autenticado
 * OU ao workspace dele.
 *
 * Response shape:
 *   200 { job: { id, kind, status, progress?, output?, error?, ... } }
 *   401 { error: 'Não autenticado.' }
 *   403 { error: 'Acesso negado.' }
 *   404 { error: 'Job não encontrado.' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import {
  getJob,
  JobNotFoundError,
  JobAccessDeniedError,
  RedisJobRepository,
} from '@/modules/jobs'
import { reportError } from '@/lib/errorReporter'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const repo = new RedisJobRepository()
    const job = await getJob(
      { repo },
      {
        id: params.id,
        requesterUserId: user.id,
        requesterWorkspaceId: user.organizationId ?? null,
      },
    )

    return NextResponse.json({ job })
  } catch (err) {
    if (err instanceof JobNotFoundError) {
      return NextResponse.json({ error: 'Job não encontrado.' }, { status: 404 })
    }
    if (err instanceof JobAccessDeniedError) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }
    reportError(err, {
      tags: { feature: 'jobs', stage: 'get_route' },
      extra: { jobId: params.id },
    })
    console.error('[/api/jobs/:id GET]', err)
    const message = err instanceof Error ? err.message : 'Erro interno.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
