import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import type { Episode } from '@/lib/types'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const redis = await getRedis()
    const key = `aaz:ep:${params.id}`
    const existing = await redis.get(key)
    if (!existing) return NextResponse.json({ error: 'Episódio não encontrado.' }, { status: 404 })
    const current = JSON.parse(existing) as Episode
    const updates = await request.json() as Partial<Episode>
    const updated = { ...current, ...updates, id: current.id }
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
    // Cascata: deleta todos os shots das cenas do episódio
    const shotKeys = await redis.keys(`aaz:shot:${params.id}:*`)
    if (shotKeys.length) for (const k of shotKeys) await redis.del(k)
    // Deleta todas as cenas do episódio
    const sceneKeys = await redis.keys(`aaz:scene:${params.id}:*`)
    if (sceneKeys.length) for (const k of sceneKeys) await redis.del(k)
    // Deleta o episódio
    await redis.del(`aaz:ep:${params.id}`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/episodes DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover episódio.' }, { status: 500 })
  }
}
