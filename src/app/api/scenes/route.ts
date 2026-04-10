import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

interface SceneAsset {
  id: string
  episodeId: string
  sceneNumber: number
  prompt: string
  videoUrl: string
  lastFrameUrl: string
  characters: string[]
  duration: number
  cost: string
  createdAt: string
}

export async function GET(request: NextRequest) {
  try {
    const episodeId = request.nextUrl.searchParams.get('episodeId')
    const pattern = episodeId ? `aaz:scene:${episodeId}:*` : 'aaz:scene:*'
    const keys = await kv.keys(pattern)
    if (keys.length === 0) return NextResponse.json([])
    const values = await kv.mget<SceneAsset[]>(...keys)
    const scenes = (values.filter(Boolean) as SceneAsset[])
      .sort((a, b) => a.sceneNumber - b.sceneNumber)
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
    await kv.set(`aaz:scene:${entry.episodeId}:${entry.id}`, entry)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/scenes POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar cena.' }, { status: 500 })
  }
}
