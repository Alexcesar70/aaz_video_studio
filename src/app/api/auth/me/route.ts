import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { DEFAULT_PERMISSIONS } from '@/lib/permissions'

/**
 * GET /api/auth/me
 * Retorna o usuário autenticado da sessão atual (lê dos headers injetados
 * pelo middleware). Usado pelo client pra saber quem tá logado + role.
 * Inclui permissions e products (Phase 4).
 */
export async function GET(request: NextRequest) {
  const user = getAuthUser(request)
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  // If user has no explicit permissions, compute effective from role defaults
  const effectivePermissions = (user.permissions && user.permissions.length > 0)
    ? user.permissions
    : (DEFAULT_PERMISSIONS[user.role] ?? [])
  return NextResponse.json({
    user: {
      ...user,
      permissions: effectivePermissions,
      products: user.products ?? [],
    },
  })
}
