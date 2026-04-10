import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'

const PREFIX = 'aaz:scenario:'

interface ScenarioEntry { id: string; name: string; imageUrl: string; createdAt: string }

export async function GET() {
  try {
    const redis = await getRedis()
    const keys = await redis.keys(`${PREFIX}*`)
    if (keys.length === 0) return NextResponse.json([])
    const scenarios: ScenarioEntry[] = []
    for (const key of keys) {
      const val = await redis.get(key)
      if (val) scenarios.push(JSON.parse(val))
    }
    return NextResponse.json(scenarios)
  } catch (err) {
    console.error('[/api/scenarios GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar cenários.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const entry: ScenarioEntry = await request.json()
    if (!entry.id || !entry.name?.trim()) {
      return NextResponse.json({ error: 'id e name são obrigatórios.' }, { status: 400 })
    }
    const redis = await getRedis()
    await redis.set(`${PREFIX}${entry.id}`, JSON.stringify(entry))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/scenarios POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar cenário.' }, { status: 500 })
  }
}
