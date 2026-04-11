import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import type { Shot } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const redis = await getRedis()
    const sceneId = request.nextUrl.searchParams.get('sceneId')
    const episodeId = request.nextUrl.searchParams.get('episodeId')
    let pattern = 'aaz:shot:*'
    if (episodeId && sceneId) pattern = `aaz:shot:${episodeId}:${sceneId}:*`
    else if (episodeId) pattern = `aaz:shot:${episodeId}:*`
    const keys = await redis.keys(pattern)
    if (keys.length === 0) return NextResponse.json([])
    const shots: Shot[] = []
    for (const key of keys) {
      const val = await redis.get(key)
      if (val) shots.push(JSON.parse(val))
    }
    shots.sort((a, b) => a.order - b.order)
    return NextResponse.json(shots)
  } catch (err) {
    console.error('[/api/shots GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar shots.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const entry: Shot = await request.json()
    if (!entry.id || !entry.sceneId || !entry.episodeId) {
      return NextResponse.json({ error: 'id, sceneId e episodeId são obrigatórios.' }, { status: 400 })
    }
    const redis = await getRedis()
    await redis.set(`aaz:shot:${entry.episodeId}:${entry.sceneId}:${entry.id}`, JSON.stringify(entry))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/shots POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar shot.' }, { status: 500 })
  }
}
