import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import {
  getUserByEmail,
  verifyPassword,
  bootstrapAdminIfEmpty,
  touchLastActive,
  updateUser,
  LEAD_ADMIN_ID,
  LEAD_ADMIN_EMAIL,
} from '@/lib/users'
import { bootstrapDefaultOrg } from '@/lib/organizations'
import { emitEvent } from '@/lib/activity'
import { checkLoginRateLimit, recordLoginAttempt } from '@/lib/rateLimit'

const SESSION_COOKIE = 'aaz_session'

function getSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET não definido')
  return new TextEncoder().encode(secret)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string; password?: string }
    const email = body.email?.trim().toLowerCase()
    const password = body.password

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios.' },
        { status: 400 }
      )
    }

    // Rate limit — bloqueia brute force por IP e por email
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? 'unknown'
    const rateCheck = await checkLoginRateLimit(ip, email)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: rateCheck.reason, retryAfterSeconds: rateCheck.retryAfterSeconds },
        { status: 429 }
      )
    }

    // Bootstrap do admin + org padrão se Redis estiver vazio (primeira inicialização).
    // Idempotente: só cria se não houver nenhum user/org.
    try {
      const bootstrapResult = await bootstrapAdminIfEmpty()
      // Se o admin foi criado agora, cria a org padrão também
      if (bootstrapResult) {
        await bootstrapDefaultOrg(bootstrapResult.user.id)
      } else {
        // Tenta criar a org padrão com o admin existente (idempotente)
        await bootstrapDefaultOrg(LEAD_ADMIN_ID)
      }
    } catch (err) {
      console.error('[auth/login] bootstrap falhou:', err)
      // Não bloqueia o login — tenta continuar; se nenhum user existir,
      // o getUserByEmail abaixo vai falhar com mensagem própria.
    }

    let user = await getUserByEmail(email)

    // Migração: promove lead admin para super_admin se ainda estiver como admin
    if (user && user.email === LEAD_ADMIN_EMAIL && user.role === 'admin') {
      await updateUser(user.id, { role: 'super_admin' })
      user = { ...user, role: 'super_admin' }
      console.log('[auth/login] Lead admin promovido para super_admin')
    }

    // Migração: associa user sem org à org padrão "aaz-com-jesus"
    if (user && !user.organizationId) {
      await updateUser(user.id, { organizationId: 'aaz-com-jesus' })
      user = { ...user, organizationId: 'aaz-com-jesus' }
      console.log(`[auth/login] User ${user.id} associado à org aaz-com-jesus`)
    }

    if (!user) {
      await recordLoginAttempt(ip, email, false)
      return NextResponse.json(
        { error: 'Email ou senha incorretos.' },
        { status: 401 }
      )
    }

    if (user.status === 'revoked') {
      return NextResponse.json(
        { error: 'Acesso revogado. Fale com o admin.' },
        { status: 403 }
      )
    }

    const passwordOk = await verifyPassword(password, user.passwordHash)
    if (!passwordOk) {
      await recordLoginAttempt(ip, email, false, user.id)
      return NextResponse.json(
        { error: 'Email ou senha incorretos.' },
        { status: 401 }
      )
    }

    // Login OK — limpa contadores de rate limit
    await recordLoginAttempt(ip, email, true, user.id)

    // Touch lastActive (não bloqueia login se falhar)
    touchLastActive(user.id).catch(() => {})

    // Emit login event
    emitEvent({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      organizationId: user.organizationId,
      type: 'login',
      meta: {},
    }).catch(() => {})

    const tokenPayload: Record<string, unknown> = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    }
    if (user.organizationId) {
      tokenPayload.organizationId = user.organizationId
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
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        permissions: user.permissions ?? [],
        products: user.products ?? [],
      },
    })

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 dias
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[auth/login]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
