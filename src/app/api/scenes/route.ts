import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'

interface SceneAsset {
  id: string; episodeId: string; sceneNumber: number; prompt: string
  videoUrl: string; lastFrameUrl: string; characters: string[]
  duration: number; cost: string; createdAt: string
}

export async function GET(request: NextRequest) {
  try {
    const redis = await getRedis()
    const episodeId = request.nextUrl.searchParams.get('episodeId')
    const pattern = episodeId ? `aaz:scene:${episodeId}:*` : 'aaz:scene:*'
    const keys = await redis.keys(pattern)
    if (keys.length === 0) return NextResponse.json([])
    const scenes: SceneAsset[] = []
    for (const key of keys) {
      const val = await redis.get(key)
      if (val) scenes.push(JSON.parse(val))
    }
    scenes.sort((a, b) => a.sceneNumber - b.sceneNumber)
    return NextResponse.json(scenes)
  } catch (err) {
    console.error('[/api/scenes GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar cenas.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const entry: SceneAsset = await request.json()
    if (!entry.id || !entry.episodeId) {
      return NextResponse.json({ error: 'id e episodeId são obrigatórios.' }, { status: 400 })
    }
    const redis = await getRedis()
    await redis.set(`aaz:scene:${entry.episodeId}:${entry.id}`, JSON.stringify(entry))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/scenes POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar cena.' }, { status: 500 })
  }
}
