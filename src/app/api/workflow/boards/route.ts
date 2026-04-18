import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createBoard, RedisBoardRepository } from '@/modules/workflow'

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request)
    const repo = new RedisBoardRepository()
    const boards = await repo.list(user.organizationId ?? '')
    return NextResponse.json({
      boards: boards.map(b => ({
        id: b.id, name: b.name, nodesCount: b.nodes.length,
        connectionsCount: b.connections.length,
        createdAt: b.createdAt, updatedAt: b.updatedAt,
      })),
    })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request)
    const body = await request.json() as { name?: string }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name é obrigatório.' }, { status: 400 })
    }
    const board = createBoard({
      name: body.name.trim(),
      workspaceId: user.organizationId ?? '',
      createdBy: user.id,
    })
    const repo = new RedisBoardRepository()
    await repo.save(board)
    return NextResponse.json({ ok: true, board })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
