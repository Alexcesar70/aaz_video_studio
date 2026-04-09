import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

const PREFIX = 'aaz:char:'

/**
 * DELETE /api/library/[id]
 * Remove um character sheet do Vercel KV
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id?.trim()) {
      return NextResponse.json({ error: 'id é obrigatório.' }, { status: 400 })
    }

    await kv.del(`${PREFIX}${id}`)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/library DELETE]', err)
    return NextResponse.json(
      { error: 'Erro ao remover da biblioteca.' },
      { status: 500 }
    )
  }
}
