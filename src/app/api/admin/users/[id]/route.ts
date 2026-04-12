import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import {
  getUserById,
  updateUser,
  resetPassword,
  toPublicUser,
  LEAD_ADMIN_ID,
  type UserRole,
  type UserStatus,
} from '@/lib/users'

/**
 * PATCH /api/admin/users/[id]
 * Update any user (role, status, permissions, products, move to different org).
 * Super admin only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireSuperAdmin(request)

    const body = await request.json() as {
      name?: string
      email?: string
      role?: UserRole
      status?: UserStatus
      monthlyBudgetUsd?: number
      assignedProjectIds?: string[]
      organizationId?: string
      permissions?: string[]
      products?: string[]
    }

    // Protection: lead admin cannot be demoted or revoked
    if (params.id === LEAD_ADMIN_ID) {
      if (body.role && body.role !== 'admin' && body.role !== 'super_admin') {
        return NextResponse.json(
          { error: 'O admin principal nao pode ser rebaixado de role.' },
          { status: 403 }
        )
      }
      if (body.status && body.status !== 'active') {
        return NextResponse.json(
          { error: 'O admin principal nao pode ser revogado.' },
          { status: 403 }
        )
      }
    }

    const updated = await updateUser(params.id, body)
    if (!updated) {
      return NextResponse.json({ error: 'Usuario nao encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, user: updated })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const msg = err instanceof Error ? err.message : 'Erro ao atualizar usuario.'
    console.error('[/api/admin/users/[id] PATCH]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

/**
 * POST /api/admin/users/[id]
 * Actions: reset_password
 * Body: { action: 'reset_password', newPassword?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireSuperAdmin(request)

    const body = await request.json() as {
      action?: string
      newPassword?: string
    }

    const user = await getUserById(params.id)
    if (!user) {
      return NextResponse.json({ error: 'Usuario nao encontrado.' }, { status: 404 })
    }

    switch (body.action) {
      case 'reset_password': {
        const result = await resetPassword(params.id, body.newPassword)
        if (!result) {
          return NextResponse.json({ error: 'Usuario nao encontrado.' }, { status: 404 })
        }
        return NextResponse.json({
          ok: true,
          user: result.user,
          plainPassword: result.plainPassword,
        })
      }

      default:
        return NextResponse.json(
          { error: `Acao desconhecida: ${body.action}` },
          { status: 400 }
        )
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const msg = err instanceof Error ? err.message : 'Erro na acao.'
    console.error('[/api/admin/users/[id] POST]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

/**
 * GET /api/admin/users/[id]
 * Get a single user detail.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireSuperAdmin(request)

    const user = await getUserById(params.id)
    if (!user) {
      return NextResponse.json({ error: 'Usuario nao encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ user: toPublicUser(user) })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[/api/admin/users/[id] GET]', err)
    return NextResponse.json({ error: 'Erro ao buscar usuario.' }, { status: 500 })
  }
}
