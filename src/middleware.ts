import { NextRequest, NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'

const SESSION_COOKIE = 'aaz_session'
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

function getSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET não definido no .env.local')
  return new TextEncoder().encode(secret)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rotas públicas — passa direto
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Verifica cookie de sessão
  const token = request.cookies.get(SESSION_COOKIE)?.value

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  try {
    const { payload } = await jwtVerify(token, getSecret())

    // Encaminha userId/role como headers de request pro backend saber
    // quem está chamando sem precisar re-parsear o JWT em cada route.
    const requestHeaders = new Headers(request.headers)
    if (payload.userId) requestHeaders.set('x-user-id', String(payload.userId))
    if (payload.role) requestHeaders.set('x-user-role', String(payload.role))
    if (payload.email) requestHeaders.set('x-user-email', String(payload.email))
    if (payload.name) requestHeaders.set('x-user-name', String(payload.name))
    if (payload.organizationId) requestHeaders.set('x-org-id', String(payload.organizationId))

    // Bloqueio de rotas /admin/* — somente super_admin tem acesso
    if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
      if (payload.role !== 'super_admin') {
        if (pathname.startsWith('/api/admin')) {
          return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
        }
        const studioUrl = new URL('/studio', request.url)
        return NextResponse.redirect(studioUrl)
      }
    }

    return NextResponse.next({ request: { headers: requestHeaders } })
  } catch {
    // Token inválido ou expirado
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete(SESSION_COOKIE)
    return response
  }
}

export const config = {
  matcher: [
    // Protege tudo exceto _next/static, _next/image, favicon e arquivos públicos
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

// ── Helpers exportados para uso nas API routes ──────────────────

export async function createSessionToken(payload: Record<string, unknown> = {}): Promise<string> {
  return new SignJWT({ ...payload, authenticated: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

export { SESSION_COOKIE }
