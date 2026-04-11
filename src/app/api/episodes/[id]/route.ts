import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'

interface Episode { id: string; name: string; projectId?: string | null; createdAt: string }

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const redis = await getRedis()
    const key = `aaz:ep:${params.id}`
    const val = await redis.get(key)
    if (!val) return NextResponse.json({ error: 'Episódio não encontrado.' }, { status: 404 })
    const current = JSON.parse(val) as Episode
    const updates = await request.json() as Partial<Episode>
    const updated: Episode = { ...current, ...updates, id: current.id }
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
    await redis.del(`aaz:ep:${params.id}`)
    const sceneKeys = await redis.keys(`aaz:scene:${params.id}:*`)
    if (sceneKeys.length) for (const k of sceneKeys) await redis.del(k)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/episodes DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover episódio.' }, { status: 500 })
  }
}

