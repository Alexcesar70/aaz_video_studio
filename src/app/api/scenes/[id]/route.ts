import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'

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
