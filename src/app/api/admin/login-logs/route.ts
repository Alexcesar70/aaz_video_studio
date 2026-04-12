import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import { getLoginLogs } from '@/lib/rateLimit'

export async function GET(request: NextRequest) {
  try {
    requireSuperAdmin(request)
    const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '100', 10)
    const logs = await getLoginLogs(Math.min(limit, 500))
    return NextResponse.json({ logs })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    return NextResponse.json({ error: 'Erro ao carregar logs.' }, { status: 500 })
  }
}
