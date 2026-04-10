import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await kv.del(`aaz:scenario:${params.id}`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/scenarios DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover cenário.' }, { status: 500 })
  }
}
