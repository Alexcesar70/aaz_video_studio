import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'

interface SceneAsset {
  id: string; episodeId: string | null; projectId?: string | null
  sceneNumber: number; prompt: string
  videoUrl: string; lastFrameUrl: string; characters: string[]
  duration: number; cost: string; createdAt: string
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
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[/api/scenes PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar cena.' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const redis = await getRedis()
    const keys = await redis.keys(`aaz:scene:*:${params.id}`)
    if (keys.length) for (const k of keys) await redis.del(k)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/scenes DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover cena.' }, { status: 500 })
  }
}
