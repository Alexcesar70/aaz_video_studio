import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'

type SceneStatus = 'draft' | 'approved' | 'rejected'
interface SceneAsset {
  id: string; episodeId: string | null; sceneNumber: number; title?: string; prompt: string
  videoUrl: string; lastFrameUrl: string; characters: string[]
  duration: number; cost: string; createdAt: string; projectId?: string | null; status?: SceneStatus
  /** Mood visual usado na geração (da lib moods). Opcional — retrocompat. */
  mood?: string
  /** Localização da cena (sdSetting), herdada em cenas encadeadas. Opcional. */
  setting?: string
  /** Emoção dos personagens (sdEmotion), herdada em cenas encadeadas. Opcional. */
  emotion?: string
}

const ORPHAN = '__orphan__'

export async function GET(request: NextRequest) {
  try {
    const redis = await getRedis()
    const episodeId = request.nextUrl.searchParams.get('episodeId')
    let pattern = 'aaz:scene:*'
    if (episodeId === 'null' || episodeId === '__orphan__') {
      pattern = `aaz:scene:${ORPHAN}:*`
    } else if (episodeId) {
      pattern = `aaz:scene:${episodeId}:*`
    }
    const keys = await redis.keys(pattern)
    if (keys.length === 0) return NextResponse.json([])
    const scenes: SceneAsset[] = []
    for (const key of keys) {
      const val = await redis.get(key)
      if (val) {
        const s = JSON.parse(val) as SceneAsset
        // Normaliza episodeId orphan
        if (s.episodeId === ORPHAN) s.episodeId = null
        scenes.push(s)
      }
    }
    // Ordena por createdAt desc (mais recentes primeiro)
    scenes.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    return NextResponse.json(scenes)
  } catch (err) {
    console.error('[/api/scenes GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar cenas.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const entry: SceneAsset = await request.json()
    if (!entry.id) {
      return NextResponse.json({ error: 'id é obrigatório.' }, { status: 400 })
    }
    const redis = await getRedis()
    const epKey = entry.episodeId || ORPHAN
    await redis.set(`aaz:scene:${epKey}:${entry.id}`, JSON.stringify(entry))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/scenes POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar cena.' }, { status: 500 })
  }
}

