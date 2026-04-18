import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { RedisBoardRepository } from '@/modules/workflow'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; nodeId: string } },
) {
  try {
    requireAuth(request)
    const repo = new RedisBoardRepository()
    const board = await repo.findById(params.id)
    if (!board) return NextResponse.json({ error: 'Board não encontrado.' }, { status: 404 })

    const node = board.nodes.find(n => n.id === params.nodeId)
    if (!node) return NextResponse.json({ error: 'Nó não encontrado.' }, { status: 404 })

    const body = await request.json() as {
      position?: { x: number; y: number }
      size?: { width: number; height: number }
      content?: Record<string, unknown>
      label?: string
      color?: string
      status?: string
      assignedTo?: string
    }

    if (body.position) node.position = body.position
    if (body.size) node.size = body.size
    if (body.content) node.content = { ...node.content, ...body.content }
    if (body.label !== undefined) node.label = body.label
    if (body.color !== undefined) node.color = body.color
    if (body.status) node.status = body.status as typeof node.status
    if (body.assignedTo !== undefined) node.assignedTo = body.assignedTo
    node.updatedAt = new Date().toISOString()

    await repo.save(board)
    return NextResponse.json({ ok: true, node })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; nodeId: string } },
) {
  try {
    requireAuth(request)
    const repo = new RedisBoardRepository()
    const board = await repo.findById(params.id)
    if (!board) return NextResponse.json({ error: 'Board não encontrado.' }, { status: 404 })

    board.nodes = board.nodes.filter(n => n.id !== params.nodeId)
    board.connections = board.connections.filter(
      c => c.source !== params.nodeId && c.target !== params.nodeId,
    )

    await repo.save(board)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
