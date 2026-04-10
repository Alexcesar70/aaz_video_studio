import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

const PREFIX = 'aaz:scenario:'

interface ScenarioEntry {
  id: string
  name: string
  imageUrl: string
  createdAt: string
}

export async function GET() {
  try {
    const keys = await kv.keys(`${PREFIX}*`)
    if (keys.length === 0) return NextResponse.json([])
    const values = await kv.mget<ScenarioEntry[]>(...keys)
    return NextResponse.json(values.filter(Boolean))
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
    await kv.set(`${PREFIX}${entry.id}`, entry)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/scenarios POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar cenário.' }, { status: 500 })
  }
}
