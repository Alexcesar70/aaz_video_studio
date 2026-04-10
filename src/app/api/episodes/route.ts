import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'

const PREFIX = 'aaz:ep:'

interface Episode { id: string; name: string; createdAt: string }

export async function GET() {
  try {
    const redis = await getRedis()
    const keys = await redis.keys(`${PREFIX}*`)
    if (keys.length === 0) return NextResponse.json([])
    const episodes: Episode[] = []
    for (const key of keys) {
      const val = await redis.get(key)
      if (val) episodes.push(JSON.parse(val))
    }
    episodes.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return NextResponse.json(episodes)
  } catch (err) {
    console.error('[/api/episodes GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar episódios.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const entry: Episode = await request.json()
    if (!entry.id || !entry.name?.trim()) {
      return NextResponse.json({ error: 'id e name são obrigatórios.' }, { status: 400 })
    }
    const redis = await getRedis()
    await redis.set(`${PREFIX}${entry.id}`, JSON.stringify(entry))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/episodes POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar episódio.' }, { status: 500 })
  }
}
