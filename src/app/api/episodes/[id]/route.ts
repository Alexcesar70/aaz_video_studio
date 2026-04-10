import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await kv.del(`aaz:ep:${params.id}`)
    // Also delete all scenes in this episode
    const sceneKeys = await kv.keys(`aaz:scene:${params.id}:*`)
    if (sceneKeys.length) await kv.del(...sceneKeys)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/episodes DELETE]', err)
    return NextResponse.json({ error: 'Erro ao remover episódio.' }, { status: 500 })
  }
}
