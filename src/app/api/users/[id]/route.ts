import { NextRequest, NextResponse } from 'next/server'
import {
  getUserById,
  updateUser,
  resetPassword,
  revokeUser,
  toPublicUser,
  LEAD_ADMIN_ID,
  type UserRole,
  type UserStatus,
} from '@/lib/users'
import { requireAdmin, AuthError } from '@/lib/auth'

/**
 * GET /api/users/[id]
 * Retorna um usuário específico. Admin only.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(request)
    const user = await getUserById(params.id)
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }
    return NextResponse.json({ user: toPublicUser(user) })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[/api/users/[id] GET]', err)
    return NextResponse.json({ error: 'Erro ao buscar usuário.' }, { status: 500 })
  }
}

/**
 * PATCH /api/users/[id]
 * Atualiza campos de um usuário. Admin only.
 *
 * Body aceita: { name?, email?, role?, status?, monthlyBudgetUsd?,
 * assignedProjectIds?, resetPassword? (boolean — se true, gera nova senha) }
 *
 * Se resetPassword=true, retorna plainPassword UMA VEZ na resposta.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(request)
    const body = await request.json() as {
      name?: string
      email?: string
      role?: UserRole
      status?: UserStatus
      monthlyBudgetUsd?: number
      assignedProjectIds?: string[]
      permissions?: string[]
      products?: string[]
      resetPassword?: boolean
      newPassword?: string
    }

    // Proteção: o admin lead (contato@qiqnada) não pode ser revogado nem
    // ter o role alterado por ninguém — garante que sempre há 1 admin.
    if (params.id === LEAD_ADMIN_ID) {
      if (body.role && body.role !== 'admin' && body.role !== 'super_admin') {
        return NextResponse.json(
          { error: 'O admin principal não pode ser rebaixado de role.' },
          { status: 403 }
        )
      }
      if (body.status && body.status !== 'active') {
        return NextResponse.json(
          { error: 'O admin principal não pode ser revogado.' },
          { status: 403 }
        )
      }
    }

    const { resetPassword: shouldReset, newPassword, ...updates } = body

    let plainPassword: string | undefined
    if (shouldReset || newPassword) {
      const result = await resetPassword(params.id, newPassword)
      if (!result) {
        return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
      }
      plainPassword = result.plainPassword
    }

    if (Object.keys(updates).length > 0) {
      const updated = await updateUser(params.id, updates)
      if (!updated) {
        return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
      }
      return NextResponse.json({ ok: true, user: updated, plainPassword })
    }

    const user = await getUserById(params.id)
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, user: toPublicUser(user), plainPassword })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const msg = err instanceof Error ? err.message : 'Erro ao atualizar usuário.'
    console.error('[/api/users/[id] PATCH]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

/**
 * DELETE /api/users/[id]
 * Revoga (soft delete) o usuário. Mantém o registro pro histórico.
 * Admin only.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireAdmin(request)

    if (params.id === LEAD_ADMIN_ID) {
      return NextResponse.json(
        { error: 'O admin principal não pode ser removido.' },
        { status: 403 }
      )
    }

    const user = await revokeUser(params.id)
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, user })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[/api/users/[id] DELETE]', err)
    return NextResponse.json({ error: 'Erro ao revogar usuário.' }, { status: 500 })
  }
}

