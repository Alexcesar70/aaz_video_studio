import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import type { Scene } from '@/lib/types'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const redis = await getRedis()
    const keys = await redis.keys(`aaz:scene:*:${params.id}`)
    if (keys.length === 0) return NextResponse.json({ error: 'Cena não encontrada.' }, { status: 404 })
    const existing = await redis.get(keys[0])
    if (!existing) return NextResponse.json({ error: 'Cena não encontrada.' }, { status: 404 })
    const current = JSON.parse(existing) as Scene
    const updates = await request.json() as Partial<Scene>
    const updated = { ...current, ...updates, id: current.id, episodeId: current.episodeId }
    await redis.set(keys[0], JSON.stringify(updated))
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[/api/scenes PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar cena.' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const redis = await getRedis()
    // Cascata: deleta shots desta cena
    const shotKeys = await redis.keys(`aaz:shot:*:${params.id}:*`)
    if (shotKeys.length) for (const k of shotKeys) await redis.del(k)
    // Deleta a cena
    const sceneKeys = await redis.keys(`aaz:scene:*:${params.id}`)
    if (sceneKeys.length) for (const k of sceneKeys) await redis.del(k)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/scenes DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover cena.' }, { status: 500 })
  }
}
