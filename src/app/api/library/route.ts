import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'

const PREFIX = 'aaz:char:'

interface LibraryEntry {
  charId: string
  name: string
  emoji: string
  sheetUrl: string
  photos: number
  createdAt: string
}

export async function GET() {
  try {
    const redis = await getRedis()
    const keys = await redis.keys(`${PREFIX}*`)
    if (keys.length === 0) return NextResponse.json({})

    const library: Record<string, LibraryEntry> = {}
    for (const key of keys) {
      const val = await redis.get(key)
      if (val) {
        const entry = JSON.parse(val) as LibraryEntry
        const charId = key.replace(PREFIX, '')
        library[charId] = entry
      }
    }
    return NextResponse.json(library)
  } catch (err) {
    console.error('[/api/library GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar biblioteca.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const entry: LibraryEntry = await request.json()
    if (!entry.charId?.trim()) {
      return NextResponse.json({ error: 'charId é obrigatório.' }, { status: 400 })
    }
    const redis = await getRedis()
    await redis.set(`${PREFIX}${entry.charId}`, JSON.stringify(entry))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/library POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar na biblioteca.' }, { status: 500 })
  }
}
