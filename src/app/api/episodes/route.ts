import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

const PREFIX = 'aaz:ep:'

interface Episode {
  id: string
  name: string
  createdAt: string
}

export async function GET() {
  try {
    const keys = await kv.keys(`${PREFIX}*`)
    if (keys.length === 0) return NextResponse.json([])
    const values = await kv.mget<Episode[]>(...keys)
    const episodes = values.filter(Boolean) as Episode[]
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
    await kv.set(`${PREFIX}${entry.id}`, entry)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/episodes POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar episódio.' }, { status: 500 })
  }
}
