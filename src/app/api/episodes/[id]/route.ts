import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'

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
