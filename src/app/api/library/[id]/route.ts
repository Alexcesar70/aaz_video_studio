import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const redis = await getRedis()
    await redis.del(`aaz:char:${params.id}`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/library DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover da biblioteca.' }, { status: 500 })
  }
}
