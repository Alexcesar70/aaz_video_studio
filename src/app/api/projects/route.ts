import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import { getAuthUser } from '@/lib/auth'
import { emitEvent } from '@/lib/activity'

const PREFIX = 'aaz:project:'

interface Project {
  id: string
  name: string
  createdAt: string
  createdBy?: string
  /** Criadores autorizados neste projeto (admin vê sempre) */
  memberIds?: string[]
}

export async function GET() {
  try {
    const redis = await getRedis()
    const keys = await redis.keys(`${PREFIX}*`)
    if (keys.length === 0) return NextResponse.json([])
    const projects: Project[] = []
    for (const key of keys) {
      const val = await redis.get(key)
      if (val) projects.push(JSON.parse(val))
    }
    projects.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return NextResponse.json(projects)
  } catch (err) {
    console.error('[/api/projects GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar projetos.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const entry: Project = await request.json()
    if (!entry.id || !entry.name?.trim()) {
      return NextResponse.json({ error: 'id e name são obrigatórios.' }, { status: 400 })
    }
    const authUser = getAuthUser(request)
    if (authUser && !entry.createdBy) {
      entry.createdBy = authUser.id
    }
    const redis = await getRedis()
    await redis.set(`${PREFIX}${entry.id}`, JSON.stringify(entry))

    if (authUser) {
      emitEvent({
        userId: authUser.id,
        userName: authUser.name,
        userEmail: authUser.email,
        userRole: authUser.role,
        type: 'project_created',
        meta: {
          projectId: entry.id,
          label: entry.name,
        },
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/projects POST]', err)
    return NextResponse.json({ error: 'Erro ao salvar projeto.' }, { status: 500 })
  }
}
