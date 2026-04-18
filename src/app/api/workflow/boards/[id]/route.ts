import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { RedisBoardRepository } from '@/modules/workflow'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    requireAuth(request)
    const repo = new RedisBoardRepository()
    const board = await repo.findById(params.id)
    if (!board) return NextResponse.json({ error: 'Board não encontrado.' }, { status: 404 })
    return NextResponse.json({ board })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    requireAuth(request)
    const repo = new RedisBoardRepository()
    const board = await repo.findById(params.id)
    if (!board) return NextResponse.json({ error: 'Board não encontrado.' }, { status: 404 })

    const body = await request.json() as {
      name?: string
      viewport?: { x: number; y: number; zoom: number }
      connections?: Array<{ id: string; source: string; target: string; label?: string }>
    }

    if (body.name) board.name = body.name.trim()
    if (body.viewport) board.viewport = body.viewport
    if (body.connections) board.connections = body.connections

    await repo.save(board)
    return NextResponse.json({ ok: true, board })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    requireAuth(request)
    const repo = new RedisBoardRepository()
    await repo.remove(params.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
