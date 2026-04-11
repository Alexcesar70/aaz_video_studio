import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import type { Episode } from '@/lib/types'

const PREFIX = 'aaz:ep:'

export async function GET(request: NextRequest) {
  try {
    const redis = await getRedis()
    const projectId = request.nextUrl.searchParams.get('projectId')
    const keys = await redis.keys(`${PREFIX}*`)
    if (keys.length === 0) return NextResponse.json([])
    const episodes: Episode[] = []
    for (const key of keys) {
      const val = await redis.get(key)
      if (val) episodes.push(JSON.parse(val))
    }
    let filtered = episodes
    if (projectId === 'null') {
      filtered = episodes.filter(e => !e.projectId)
    } else if (projectId) {
      filtered = episodes.filter(e => e.projectId === projectId)
    }
    filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return NextResponse.json(filtered)
  } catch (err) {
    console.error('[/api/episodes GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar episódios.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const entry: Episode = await request.json()
    if (!entry.id || !entry.title?.trim()) {
      return NextResponse.json({ error: 'id e title são obrigatórios.' }, { status: 400 })
    }
    const redis = await getRedis()
    await redis.set(`${PREFIX}${entry.id}`, JSON.stringify(entry))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/episodes POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar episódio.' }, { status: 500 })
  }
}
