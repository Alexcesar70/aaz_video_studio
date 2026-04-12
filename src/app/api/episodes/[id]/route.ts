import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import { getAuthUser, requireAdmin, AuthError } from '@/lib/auth'
import { emitEvent } from '@/lib/activity'
import { del as blobDel } from '@vercel/blob'

type FinalStatus = 'none' | 'pending_review' | 'approved' | 'needs_changes'

interface Episode {
  id: string
  name: string
  projectId?: string | null
  createdAt: string
  createdBy?: string
  finalVideoUrl?: string
  finalVideoSizeMB?: number
  finalVideoUploadedAt?: string
  finalVideoUploadedBy?: string
  finalStatus?: FinalStatus
  reviewNote?: string
  reviewedAt?: string
  reviewedBy?: string
  creatorNote?: string
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const redis = await getRedis()
    const key = `aaz:ep:${params.id}`
    const val = await redis.get(key)
    if (!val) return NextResponse.json({ error: 'Episódio não encontrado.' }, { status: 404 })
    const current = JSON.parse(val) as Episode
    const updates = await request.json() as Partial<Episode> & { action?: 'submit_delivery' | 'review' | 'upload_delivery' }
    const authUser = getAuthUser(request)

    // Ação: creator submete entrega final (upload + notas)
    // Body: { action: 'upload_delivery', finalVideoUrl, finalVideoSizeMB, creatorNote? }
    if (updates.action === 'upload_delivery') {
      if (!updates.finalVideoUrl) {
        return NextResponse.json({ error: 'finalVideoUrl é obrigatório.' }, { status: 400 })
      }
      // Se já havia um vídeo anterior diferente, tenta apagar do Blob pra
      // não acumular storage
      if (current.finalVideoUrl && current.finalVideoUrl !== updates.finalVideoUrl) {
        try { await blobDel(current.finalVideoUrl) } catch { /* silent */ }
      }
      const now = new Date().toISOString()
      const updated: Episode = {
        ...current,
        finalVideoUrl: updates.finalVideoUrl,
        finalVideoSizeMB: updates.finalVideoSizeMB,
        finalVideoUploadedAt: now,
        finalVideoUploadedBy: authUser?.id,
        finalStatus: 'pending_review',
        creatorNote: updates.creatorNote,
        // Limpa review anterior — nova versão precisa de nova revisão
        reviewNote: undefined,
        reviewedAt: undefined,
        reviewedBy: undefined,
      }
      await redis.set(key, JSON.stringify(updated))

      if (authUser) {
        emitEvent({
          userId: authUser.id,
          userName: authUser.name,
          userEmail: authUser.email,
          userRole: authUser.role,
          type: 'episode_delivery_uploaded',
          meta: {
            episodeId: current.id,
            label: current.name,
            extra: { sizeMB: updates.finalVideoSizeMB },
          },
        }).catch(() => {})
      }
      return NextResponse.json(updated)
    }

    // Ação: admin revisa uma entrega — aprova ou pede ajustes
    // Body: { action: 'review', finalStatus: 'approved'|'needs_changes', reviewNote }
    if (updates.action === 'review') {
      // Só admin pode revisar
      try {
        requireAdmin(request)
      } catch (e) {
        if (e instanceof AuthError) {
          return NextResponse.json({ error: e.message }, { status: e.status })
        }
        throw e
      }
      if (!updates.finalStatus || !['approved', 'needs_changes', 'pending_review'].includes(updates.finalStatus)) {
        return NextResponse.json({ error: 'finalStatus inválido.' }, { status: 400 })
      }
      const now = new Date().toISOString()
      const updated: Episode = {
        ...current,
        finalStatus: updates.finalStatus,
        reviewNote: updates.reviewNote,
        reviewedAt: now,
        reviewedBy: authUser?.id,
      }
      await redis.set(key, JSON.stringify(updated))

      if (authUser) {
        emitEvent({
          userId: authUser.id,
          userName: authUser.name,
          userEmail: authUser.email,
          userRole: authUser.role,
          type: 'episode_delivery_reviewed',
          meta: {
            episodeId: current.id,
            label: current.name,
            newStatus: updates.finalStatus,
          },
        }).catch(() => {})
      }
      return NextResponse.json(updated)
    }

    // PATCH padrão (rename, mover de projeto, etc)
    const { action: _ignored, ...safeUpdates } = updates
    void _ignored
    const updated: Episode = { ...current, ...safeUpdates, id: current.id }
    await redis.set(key, JSON.stringify(updated))
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[/api/episodes PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar episódio.' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const redis = await getRedis()
    // Se havia final video, apaga do Blob
    const val = await redis.get(`aaz:ep:${params.id}`)
    if (val) {
      try {
        const ep = JSON.parse(val) as Episode
        if (ep.finalVideoUrl) {
          try { await blobDel(ep.finalVideoUrl) } catch { /* silent */ }
        }
      } catch {}
    }
    await redis.del(`aaz:ep:${params.id}`)
    const sceneKeys = await redis.keys(`aaz:scene:${params.id}:*`)
    if (sceneKeys.length) for (const k of sceneKeys) await redis.del(k)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/episodes DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover episódio.' }, { status: 500 })
  }
}
