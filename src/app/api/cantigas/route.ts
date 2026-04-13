import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { createCantiga, listCantigas, type Cantiga } from '@/lib/cantigas'

export const dynamic = 'force-dynamic'

/** GET /api/cantigas — lista cantigas do user/org */
export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    const cantigas = await listCantigas(user.organizationId, user.id)
    return NextResponse.json({ cantigas })
  } catch (err) {
    console.error('[/api/cantigas GET]', err)
    return NextResponse.json({ error: 'Erro ao listar cantigas.' }, { status: 500 })
  }
}

/** POST /api/cantigas — cria nova cantiga */
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const body = await request.json()
    const cantiga = await createCantiga({
      title: body.title || 'Nova cantiga',
      status: 'lyrics',
      step: 1,
      createdBy: user.id,
      organizationId: user.organizationId,
      idea: body.idea || '',
      theme: body.theme || '',
      characters: body.characters || [],
      lyrics: body.lyrics || '',
      musicDuration: body.musicDuration || '1:30',
      refraoCount: body.refraoCount ?? 1,
      useRhyme: body.useRhyme ?? true,
      musicUrl: '',
      musicStyle: body.musicStyle || '',
      storyboard: [],
    })
    return NextResponse.json({ cantiga })
  } catch (err) {
    console.error('[/api/cantigas POST]', err)
    return NextResponse.json({ error: 'Erro ao criar cantiga.' }, { status: 500 })
  }
}
