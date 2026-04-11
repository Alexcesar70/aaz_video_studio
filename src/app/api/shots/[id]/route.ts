import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import type { Shot } from '@/lib/types'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const redis = await getRedis()
    const keys = await redis.keys(`aaz:shot:*:${params.id}`)
    if (keys.length === 0) return NextResponse.json({ error: 'Shot não encontrado.' }, { status: 404 })
    const val = await redis.get(keys[0])
    if (!val) return NextResponse.json({ error: 'Shot não encontrado.' }, { status: 404 })
    return NextResponse.json(JSON.parse(val))
  } catch (err) {
    console.error('[/api/shots GET id]', err)
    return NextResponse.json({ error: 'Erro ao carregar shot.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const redis = await getRedis()
    const keys = await redis.keys(`aaz:shot:*:${params.id}`)
    if (keys.length === 0) return NextResponse.json({ error: 'Shot não encontrado.' }, { status: 404 })
    const existing = await redis.get(keys[0])
    if (!existing) return NextResponse.json({ error: 'Shot não encontrado.' }, { status: 404 })
    const current = JSON.parse(existing) as Shot
    const updates = await request.json() as Partial<Shot>
    const updated = { ...current, ...updates, id: current.id, sceneId: current.sceneId, episodeId: current.episodeId }
    await redis.set(keys[0], JSON.stringify(updated))
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[/api/shots PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar shot.' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const redis = await getRedis()
    const keys = await redis.keys(`aaz:shot:*:${params.id}`)
    if (keys.length) for (const k of keys) await redis.del(k)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/shots DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover shot.' }, { status: 500 })
  }
}
