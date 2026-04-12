import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import { getAuthUser } from '@/lib/auth'
import { emitEvent } from '@/lib/activity'

type SceneStatus = 'draft' | 'approved' | 'rejected'
interface SceneAsset {
  id: string; episodeId: string | null; projectId?: string | null
  sceneNumber: number; title?: string; prompt: string
  videoUrl: string; lastFrameUrl: string; characters: string[]
  duration: number; cost: string; createdAt: string; status?: SceneStatus
  mood?: string
  setting?: string
  emotion?: string
  createdBy?: string
}

const ORPHAN = '__orphan__'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const redis = await getRedis()
    const updates = await request.json() as Partial<SceneAsset>
    // Localiza a cena atual
    const keys = await redis.keys(`aaz:scene:*:${params.id}`)
    if (keys.length === 0) return NextResponse.json({ error: 'Cena não encontrada.' }, { status: 404 })
    const oldKey = keys[0]
    const val = await redis.get(oldKey)
    if (!val) return NextResponse.json({ error: 'Cena não encontrada.' }, { status: 404 })
    const current = JSON.parse(val) as SceneAsset
    const updated: SceneAsset = { ...current, ...updates, id: current.id }
    // Se episodeId mudou, chave do Redis muda — deleta a antiga e cria a nova
    const oldEpKey = current.episodeId || ORPHAN
    const newEpKey = updated.episodeId || ORPHAN
    if (oldEpKey !== newEpKey) {
      await redis.del(oldKey)
    }
    await redis.set(`aaz:scene:${newEpKey}:${updated.id}`, JSON.stringify(updated))

    // Emit event se o status mudou
    if (updates.status && updates.status !== current.status) {
      const authUser = getAuthUser(request)
      if (authUser) {
        emitEvent({
          userId: authUser.id,
          userName: authUser.name,
          userEmail: authUser.email,
          userRole: authUser.role,
          organizationId: authUser.organizationId,
          type: 'scene_status_changed',
          meta: {
            sceneId: current.id,
            oldStatus: current.status,
            newStatus: updates.status,
            label: current.title,
            projectId: current.projectId ?? undefined,
            episodeId: current.episodeId ?? undefined,
          },
        }).catch(() => {})
      }
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[/api/scenes PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar cena.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const redis = await getRedis()
    // Carrega antes pra emitir evento com label + meta
    const keys = await redis.keys(`aaz:scene:*:${params.id}`)
    let deletedScene: SceneAsset | null = null
    if (keys.length) {
      const val = await redis.get(keys[0])
      if (val) deletedScene = JSON.parse(val) as SceneAsset
      for (const k of keys) await redis.del(k)
    }

    const authUser = getAuthUser(request)
    if (authUser && deletedScene) {
      emitEvent({
        userId: authUser.id,
        userName: authUser.name,
        userEmail: authUser.email,
        userRole: authUser.role,
        organizationId: authUser.organizationId,
        type: 'scene_deleted',
        meta: {
          sceneId: deletedScene.id,
          label: deletedScene.title,
          projectId: deletedScene.projectId ?? undefined,
          episodeId: deletedScene.episodeId ?? undefined,
        },
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/scenes DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover cena.' }, { status: 500 })
  }
}
