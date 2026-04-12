import { NextRequest, NextResponse } from 'next/server'
import { listUsers, createUser, type UserRole } from '@/lib/users'
import { requireAdmin, AuthError } from '@/lib/auth'
import { emitEvent } from '@/lib/activity'

/**
 * GET /api/users
 * Lista todos os usuários. Só admin.
 */
export async function GET(request: NextRequest) {
  try {
    requireAdmin(request)
    const users = await listUsers()
    return NextResponse.json({ users })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[/api/users GET]', err)
    return NextResponse.json({ error: 'Erro ao listar usuários.' }, { status: 500 })
  }
}

/**
 * POST /api/users
 * Cria um novo usuário. Só admin.
 *
 * Body: { name, email, role, monthlyBudgetUsd?, assignedProjectIds? }
 * Senha é gerada automaticamente (16 chars aleatórios). Retornada UMA VEZ
 * na resposta pra admin copiar e enviar ao novo user.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = requireAdmin(request)
    const body = await request.json() as {
      name?: string
      email?: string
      role?: UserRole
      monthlyBudgetUsd?: number
      assignedProjectIds?: string[]
      password?: string // opcional — admin pode forçar uma senha específica
    }

    if (!body.name || !body.email || !body.role) {
      return NextResponse.json(
        { error: 'name, email e role são obrigatórios.' },
        { status: 400 }
      )
    }
    if (body.role !== 'super_admin' && body.role !== 'admin' && body.role !== 'creator') {
      return NextResponse.json(
        { error: 'role deve ser super_admin, admin ou creator.' },
        { status: 400 }
      )
    }

    const result = await createUser({
      name: body.name,
      email: body.email,
      role: body.role,
      password: body.password,
      monthlyBudgetUsd: body.monthlyBudgetUsd,
      assignedProjectIds: body.assignedProjectIds,
      createdBy: admin.id,
    })

    emitEvent({
      userId: admin.id,
      userName: admin.name,
      userEmail: admin.email,
      userRole: admin.role,
      organizationId: admin.organizationId,
      type: 'user_created',
      meta: {
        targetUserId: result.user.id,
        label: `${result.user.name} (${result.user.role})`,
      },
    }).catch(() => {})

    return NextResponse.json({
      ok: true,
      user: result.user,
      plainPassword: result.plainPassword, // mostrado UMA VEZ
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const msg = err instanceof Error ? err.message : 'Erro ao criar usuário.'
    console.error('[/api/users POST]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
