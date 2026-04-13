import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getCantiga, updateCantiga, deleteCantiga } from '@/lib/cantigas'

/** GET /api/cantigas/[id] — detalhe */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    const cantiga = await getCantiga(user.organizationId, params.id)
    if (!cantiga) return NextResponse.json({ error: 'Cantiga não encontrada.' }, { status: 404 })
    if (cantiga.createdBy !== user.id && user.role !== 'admin' && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }
    return NextResponse.json({ cantiga })
  } catch (err) {
    console.error('[/api/cantigas/[id] GET]', err)
    return NextResponse.json({ error: 'Erro.' }, { status: 500 })
  }
}

/** PATCH /api/cantigas/[id] — auto-save */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const existing = await getCantiga(user.organizationId, params.id)
    if (!existing) return NextResponse.json({ error: 'Cantiga não encontrada.' }, { status: 404 })
    if (existing.createdBy !== user.id && user.role !== 'admin' && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const body = await request.json()
    const updated = await updateCantiga(user.organizationId, params.id, body)
    return NextResponse.json({ cantiga: updated })
  } catch (err) {
    console.error('[/api/cantigas/[id] PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar.' }, { status: 500 })
  }
}

/** DELETE /api/cantigas/[id] */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    const existing = await getCantiga(user.organizationId, params.id)
    if (!existing) return NextResponse.json({ error: 'Não encontrada.' }, { status: 404 })
    if (existing.createdBy !== user.id && user.role !== 'admin' && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }
    await deleteCantiga(user.organizationId, params.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/cantigas/[id] DELETE]', err)
    return NextResponse.json({ error: 'Erro ao deletar.' }, { status: 500 })
  }
}
