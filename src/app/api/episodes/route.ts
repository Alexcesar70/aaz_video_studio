import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import { getAuthUser } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { emitEvent } from '@/lib/activity'
import {
  selectEpisodeRepo,
  EPISODES_LEGACY_WORKSPACE_ID,
} from '@/modules/episodes'

const PREFIX = 'aaz:ep:'

interface Episode {
  id: string
  name: string
  projectId?: string | null
  createdAt: string
  createdBy?: string
  /** Entrega final do episódio (upload do MP4 montado no CapCut/Premiere) */
  finalVideoUrl?: string
  finalVideoSizeMB?: number
  finalVideoUploadedAt?: string
  finalVideoUploadedBy?: string
  finalStatus?: 'none' | 'pending_review' | 'approved' | 'needs_changes'
  reviewNote?: string
  reviewedAt?: string
  reviewedBy?: string
  creatorNote?: string
  /** Organização dona do episódio (multi-tenant Phase 2) */
  organizationId?: string
}

/**
 * GET /api/episodes — M5-PR2: lê via composer.
 * Mesma estratégia do /api/projects (legacy data via sentinel).
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request)
    const orgId = authUser?.organizationId

    const repo = selectEpisodeRepo({
      userId: authUser?.id,
      workspaceId: orgId,
    })

    const epsForOrg = orgId
      ? await repo.list({ workspaceId: orgId })
      : await repo.list()

    const legacyVisible = orgId
      ? await repo.list({ workspaceId: EPISODES_LEGACY_WORKSPACE_ID })
      : []

    const merged = [...epsForOrg, ...legacyVisible]
    merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

    const out: Episode[] = merged.map((e) => ({
      id: e.id,
      name: e.name,
      projectId: e.projectId,
      createdAt: e.createdAt,
      createdBy: e.createdBy,
      finalVideoUrl: e.finalVideoUrl,
      finalVideoSizeMB: e.finalVideoSizeMb,
      finalVideoUploadedAt: e.finalVideoUploadedAt,
      finalVideoUploadedBy: e.finalVideoUploadedBy,
      finalStatus: e.finalStatus,
      reviewNote: e.reviewNote,
      reviewedAt: e.reviewedAt,
      reviewedBy: e.reviewedBy,
      creatorNote: e.creatorNote,
      organizationId:
        e.workspaceId === EPISODES_LEGACY_WORKSPACE_ID
          ? undefined
          : e.workspaceId,
    }))
    return NextResponse.json(out)
  } catch (err) {
    console.error('[/api/episodes GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar episódios.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUser(request)
    if (authUser && !hasPermission(authUser.permissions, authUser.role, PERMISSIONS.MANAGE_EPISODES)) {
      return NextResponse.json({ error: 'Sem permissão para gerenciar episódios.' }, { status: 403 })
    }

    const entry: Episode = await request.json()
    if (!entry.id || !entry.name?.trim()) {
      return NextResponse.json({ error: 'id e name são obrigatórios.' }, { status: 400 })
    }
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
        type: 'episode_created',
        meta: {
          episodeId: entry.id,
          projectId: entry.projectId ?? undefined,
          label: entry.name,
        },
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/episodes POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar episódio.' }, { status: 500 })
  }
}
