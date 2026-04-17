/**
 * POST /api/admin/switch-workspace
 *
 * Permite ao super_admin trocar de workspace sem re-login.
 * Emite JWT novo com o organizationId/organizationName do workspace
 * alvo e seta o cookie de sessão.
 *
 * O super_admin mantém seu role e identidade — só muda o contexto
 * de workspace. Isso permite navegar entre workspaces pra debug,
 * teste de isolamento, e administração multi-tenant.
 *
 * Body:
 *   { workspaceId: string }
 *
 * Response:
 *   { ok: true, workspace: { id, name }, previousWorkspaceId }
 *   + cookie aaz_session atualizado
 *
 * Segurança: super_admin-only (requireSuperAdmin).
 */

import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import { getOrgById } from '@/lib/organizations'
import { getUserById } from '@/lib/users'

const SESSION_COOKIE = 'aaz_session'

function getSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET não definido')
  return new TextEncoder().encode(secret)
}

export async function POST(request: NextRequest) {
  try {
    const admin = requireSuperAdmin(request)

    const body = (await request.json().catch(() => ({}))) as {
      workspaceId?: string
    }

    if (!body.workspaceId?.trim()) {
      return NextResponse.json(
        { error: 'workspaceId é obrigatório.' },
        { status: 400 },
      )
    }

    const targetId = body.workspaceId.trim()
    const org = await getOrgById(targetId)
    if (!org) {
      return NextResponse.json(
        { error: `Workspace "${targetId}" não encontrado.` },
        { status: 404 },
      )
    }

    const user = await getUserById(admin.id)
    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado.' },
        { status: 404 },
      )
    }

    const previousWorkspaceId = admin.workspaceId ?? null

    const tokenPayload: Record<string, unknown> = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      organizationId: org.id,
      organizationName: org.name,
    }
    if (user.permissions && user.permissions.length > 0) {
      tokenPayload.permissions = user.permissions
    }
    if (user.products && user.products.length > 0) {
      tokenPayload.products = user.products
    }

    const token = await new SignJWT(tokenPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(getSecret())

    const response = NextResponse.json({
      ok: true,
      workspace: { id: org.id, name: org.name },
      previousWorkspaceId,
    })

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[POST /api/admin/switch-workspace]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
