import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'

interface Episode { id: string; name: string; projectId?: string | null; createdAt: string }

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const redis = await getRedis()
    // Desvincula episódios ligados (projectId vira null)
    const epKeys = await redis.keys('aaz:ep:*')
    for (const k of epKeys) {
      const v = await redis.get(k)
      if (!v) continue
      const ep = JSON.parse(v) as Episode
      if (ep.projectId === params.id) {
        ep.projectId = null
        await redis.set(k, JSON.stringify(ep))
      }
    }
    await redis.del(`aaz:project:${params.id}`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/projects DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover projeto.' }, { status: 500 })
  }
}
