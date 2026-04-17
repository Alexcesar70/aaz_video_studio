import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import { getAuthUser } from '@/lib/auth'
import { emitEvent } from '@/lib/activity'
import {
  selectProjectRepo,
} from '@/modules/projects'

const PREFIX = 'aaz:project:'

interface Project {
  id: string
  name: string
  createdAt: string
  createdBy?: string
  /** Criadores autorizados neste projeto (admin vê sempre) */
  memberIds?: string[]
  /** Organização dona do projeto (multi-tenant Phase 2) */
  organizationId?: string
}

/**
 * GET /api/projects — M5-PR2: lê via composer.
 *
 * Default OFF: comportamento idêntico ao histórico (Redis com filtro
 * de orgId + legacy data sem orgId). Com USE_POSTGRES_PROJECTS=on,
 * lê do Postgres (sem legacy — backfill deve ter assinado os
 * orphans antes).
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request)
    const orgId = authUser?.organizationId

    const repo = selectProjectRepo({
      userId: authUser?.id,
      workspaceId: orgId,
    })

    const projectsForOrg = orgId
      ? await repo.list({ workspaceId: orgId })
      : await repo.list()

    projectsForOrg.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    // Mapeia ao shape legado pro client (omit workspaceId='__legacy__'
    // → organizationId: undefined).
    const out: Project[] = projectsForOrg.map((p) => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
      createdBy: p.createdBy,
      memberIds: p.memberIds,
      organizationId: p.workspaceId,
    }))
    return NextResponse.json(out)
  } catch (err) {
    console.error('[/api/projects GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar projetos.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const entry: Project = await request.json()
    if (!entry.id || !entry.name?.trim()) {
      return NextResponse.json({ error: 'id e name são obrigatórios.' }, { status: 400 })
    }
    const authUser = getAuthUser(request)
    if (authUser && !entry.createdBy) {
      entry.createdBy = authUser.id
    }
    // Multi-tenant: stamp organizationId on creation
    if (authUser?.organizationId && !entry.organizationId) {
      entry.organizationId = authUser.organizationId
    }
    const redis = await getRedis()
    await redis.set(`${PREFIX}${entry.id}`, JSON.stringify(entry))

    if (authUser) {
      emitEvent({
        userId: authUser.id,
        userName: authUser.name,
        userEmail: authUser.email,
        userRole: authUser.role,
        organizationId: authUser.organizationId,
        type: 'project_created',
        meta: {
          projectId: entry.id,
          label: entry.name,
        },
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/projects POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar projeto.' }, { status: 500 })
  }
}
