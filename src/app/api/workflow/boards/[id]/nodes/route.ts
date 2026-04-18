import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createNode, RedisBoardRepository, type NodeType } from '@/modules/workflow'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = requireAuth(request)
    const repo = new RedisBoardRepository()
    const board = await repo.findById(params.id)
    if (!board) return NextResponse.json({ error: 'Board não encontrado.' }, { status: 404 })

    const body = await request.json() as {
      type?: string
      position?: { x: number; y: number }
      content?: Record<string, unknown>
      label?: string
      color?: string
    }

    if (!body.type || !body.position) {
      return NextResponse.json({ error: 'type e position são obrigatórios.' }, { status: 400 })
    }

    const node = createNode({
      type: body.type as NodeType,
      position: body.position,
      content: body.content,
      label: body.label,
      color: body.color,
      createdBy: user.id,
    })

    board.nodes.push(node)
    await repo.save(board)

    return NextResponse.json({ ok: true, node })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
