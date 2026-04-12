import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import { getAuthUser } from '@/lib/auth'

const PREFIX = 'aaz:scenario:'

interface ScenarioEntry {
  id: string
  name: string
  imageUrl: string
  createdAt: string
  createdBy?: string
  /** Organização dona do cenário (multi-tenant Phase 2) */
  organizationId?: string
}

export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request)
    const orgId = authUser?.organizationId

    const redis = await getRedis()
    const keys = await redis.keys(`${PREFIX}*`)
    if (keys.length === 0) return NextResponse.json([])
    const scenarios: ScenarioEntry[] = []
    for (const key of keys) {
      const val = await redis.get(key)
      if (val) scenarios.push(JSON.parse(val))
    }

    // Multi-tenant filtering: users in an org see their org's data + legacy data
    const filtered = orgId
      ? scenarios.filter(s => s.organizationId === orgId || !s.organizationId)
      : scenarios

    return NextResponse.json(filtered)
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
    // Multi-tenant: stamp organizationId on creation
    const authUser = getAuthUser(request)
    if (authUser?.organizationId && !entry.organizationId) {
      entry.organizationId = authUser.organizationId
    }
    if (authUser && !entry.createdBy) {
      entry.createdBy = authUser.id
    }
    const redis = await getRedis()
    await redis.set(`${PREFIX}${entry.id}`, JSON.stringify(entry))
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/scenarios POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar cenário.' }, { status: 500 })
  }
}
