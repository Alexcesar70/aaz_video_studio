import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createOrganization } from '@/lib/organizations'
import { createUser } from '@/lib/users'
import { emitEvent } from '@/lib/activity'

/**
 * POST /api/admin/seed-workspace
 *
 * Cria um workspace novo do zero com um user admin owner, numa única
 * chamada. Uso: testar a plataforma como se fosse um tenant limpo,
 * sem herdar biblioteca/characters do workspace do super_admin.
 *
 * Restrito a super_admin (fora do super_admin, use o signup público).
 *
 * Body:
 *   { workspaceName, ownerName, ownerEmail, ownerPassword?, plan?, type? }
 *
 * Response:
 *   { workspace, user, plainPassword }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = requireAuth(request)
    if (admin.role !== 'super_admin') {
      return NextResponse.json({ error: 'Apenas super_admin.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null) as {
      workspaceName?: string
      ownerName?: string
      ownerEmail?: string
      ownerPassword?: string
      plan?: string
      type?: 'individual' | 'team'
      products?: string[]
      maxUsers?: number
    } | null

    if (!body?.workspaceName?.trim() || !body.ownerName?.trim() || !body.ownerEmail?.trim()) {
      return NextResponse.json(
        { error: 'workspaceName, ownerName e ownerEmail são obrigatórios.' },
        { status: 400 },
      )
    }

    const type = body.type ?? 'individual'
    const plan = body.plan ?? 'trial'
    const products = body.products ?? ['workflow', 'studio', 'creators']
    const maxUsers = body.maxUsers ?? (type === 'individual' ? 1 : 10)

    // 1. Cria user ORFÃO primeiro (sem workspace) — apenas pra ter ownerId
    // Usamos um createUser com workspaceId temporário; depois amarramos no novo workspace.
    const userResult = await createUser({
      name: body.ownerName.trim(),
      email: body.ownerEmail.trim().toLowerCase(),
      role: 'admin',
      password: body.ownerPassword,
      // organizationId vai ser setado depois via updateUser
      createdBy: admin.id,
    })

    // 2. Cria a organization com o user como owner
    const org = await createOrganization({
      name: body.workspaceName.trim(),
      plan,
      ownerId: userResult.user.id,
      type,
      maxUsers,
      products,
      billingEmail: body.ownerEmail.trim().toLowerCase(),
    })

    // 3. Amarra user.organizationId no novo workspace
    const { updateUser } = await import('@/lib/users')
    await updateUser(userResult.user.id, { organizationId: org.id })

    emitEvent({
      userId: admin.id,
      userName: admin.name,
      userEmail: admin.email,
      userRole: admin.role,
      organizationId: admin.organizationId,
      type: 'workspace_created',
      meta: {
        label: `${org.name} (seed)`,
        targetUserId: userResult.user.id,
      },
    }).catch(() => {})

    return NextResponse.json({
      ok: true,
      workspace: { id: org.id, name: org.name, plan: org.plan },
      user: { id: userResult.user.id, email: userResult.user.email, role: 'admin' },
      plainPassword: userResult.plainPassword,
      hint: 'Faça logout do super_admin e login com o email+senha retornados pra entrar no novo workspace.',
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const msg = err instanceof Error ? err.message : 'Erro ao criar workspace.'
    console.error('[/api/admin/seed-workspace]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
