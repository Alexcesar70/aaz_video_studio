import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

/**
 * GET /api/auth/me
 * Retorna o usuário autenticado da sessão atual (lê dos headers injetados
 * pelo middleware). Usado pelo client pra saber quem tá logado + role.
 */
export async function GET(request: NextRequest) {
  const user = getAuthUser(request)
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  return NextResponse.json({ user })
}
