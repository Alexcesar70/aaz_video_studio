/**
 * Helpers server-side pra identificar o usuário autenticado numa API route.
 *
 * O middleware injeta x-user-id, x-user-role, x-user-email, x-user-name
 * nos headers de toda request autenticada (após validar o JWT). Essas
 * funções são açúcar pra ler esses headers sem boilerplate.
 */

import { NextRequest } from 'next/server'
import type { UserRole } from './users'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  /**
   * ID do workspace ao qual o usuário pertence.
   *
   * PR #8: "workspaceId" é a nomenclatura canônica do produto. Código
   * novo deve preferir esse campo. `organizationId` é mantido como
   * alias deprecated até PR #9 consolidar.
   *
   * Ambos são preenchidos com o mesmo valor — o header `x-org-id`
   * do middleware (que mapeia ao JWT.organizationId legado).
   */
  workspaceId?: string
  /** @deprecated Use `workspaceId`. Mantido por retrocompat — ADR-0004. */
  organizationId?: string
  /** Granular permissions (Phase 4). Empty = fall back to role defaults. */
  permissions?: string[]
  /** Product access (Phase 4). Empty = inherit from org. */
  products?: string[]
}

/**
 * Retorna o usuário autenticado a partir dos headers injetados pelo
 * middleware. Null se a request não for autenticada (ex: rota pública).
 */
export function getAuthUser(request: NextRequest): AuthUser | null {
  const id = request.headers.get('x-user-id')
  const email = request.headers.get('x-user-email')
  const name = request.headers.get('x-user-name')
  const role = request.headers.get('x-user-role') as UserRole | null
  const organizationId = request.headers.get('x-org-id')
  const permissionsRaw = request.headers.get('x-user-permissions')
  const productsRaw = request.headers.get('x-user-products')
  if (!id || !role) return null

  let permissions: string[] | undefined
  let products: string[] | undefined
  try { permissions = permissionsRaw ? JSON.parse(permissionsRaw) : undefined } catch { /* ignore */ }
  try { products = productsRaw ? JSON.parse(productsRaw) : undefined } catch { /* ignore */ }

  const workspaceId = organizationId ?? undefined

  return {
    id,
    email: email ?? '',
    name: name ?? '',
    role,
    workspaceId,
    organizationId: workspaceId, // alias deprecated — ver ADR-0004
    permissions,
    products,
  }
}

/**
 * Retorna o workspaceId efetivo do usuário autenticado.
 * Null se o usuário não pertence a nenhum workspace (caso no novo fluxo
 * de signup pré-wizard — flag NEW_SIGNUP_WIZARD).
 */
export function getWorkspaceId(request: NextRequest): string | null {
  return getAuthUser(request)?.workspaceId ?? null
}

/**
 * Verifica se a request é de um admin ou super_admin.
 * Útil pra gatear APIs sensíveis.
 */
export function isAdmin(request: NextRequest): boolean {
  const role = getAuthUser(request)?.role
  return role === 'admin' || role === 'super_admin'
}

/**
 * Retorna o usuário autenticado ou lança erro se não for admin/super_admin.
 * Usado no topo de APIs /api/admin/** e /api/users/**.
 */
export function requireAdmin(request: NextRequest): AuthUser {
  const user = getAuthUser(request)
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    throw new AuthError('Admin access required', 403)
  }
  return user
}

/**
 * Retorna o usuário autenticado ou lança erro se não for super_admin.
 * Usado no topo de APIs /api/admin/** exclusivas do dono da plataforma.
 */
export function requireSuperAdmin(request: NextRequest): AuthUser {
  const user = getAuthUser(request)
  if (!user || user.role !== 'super_admin') {
    throw new AuthError('Super admin access required', 403)
  }
  return user
}

/**
 * Retorna o usuário autenticado ou lança erro se não estiver logado.
 */
export function requireAuth(request: NextRequest): AuthUser {
  const user = getAuthUser(request)
  if (!user) {
    throw new AuthError('Not authenticated', 401)
  }
  return user
}

export class AuthError extends Error {
  constructor(message: string, public status: number = 401) {
    super(message)
    this.name = 'AuthError'
  }
}
