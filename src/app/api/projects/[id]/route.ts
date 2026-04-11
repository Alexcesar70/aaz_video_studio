import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import type { Project, Episode } from '@/lib/types'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const redis = await getRedis()
    const key = `aaz:project:${params.id}`
    const existing = await redis.get(key)
    if (!existing) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
    const current = JSON.parse(existing) as Project
    const updates = await request.json() as Partial<Project>
    const updated = { ...current, ...updates, id: current.id }
    await redis.set(key, JSON.stringify(updated))
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[/api/projects PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar projeto.' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const redis = await getRedis()
    // Desvincula episódios (projectId vira null, não deleta)
    const epKeys = await redis.keys('aaz:ep:*')
    for (const k of epKeys) {
      const v = await redis.get(k)
      if (!v) continue
      const ep = JSON.parse(v) as Episode
      if (ep.projectId === params.id) {
        ep.projectId = null
        await redis.set(k, JSON.stringify(ep))
      }
    }
    await redis.del(`aaz:project:${params.id}`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/projects DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover projeto.' }, { status: 500 })
  }
}
