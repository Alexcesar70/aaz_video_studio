import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // id format: episodeId:sceneId
    const keys = await kv.keys(`aaz:scene:*:${params.id}`)
    if (keys.length) await kv.del(...keys)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/scenes DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover cena.' }, { status: 500 })
  }
}
