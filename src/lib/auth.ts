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
  if (!id || !role) return null
  return {
    id,
    email: email ?? '',
    name: name ?? '',
    role,
  }
}

/**
 * Verifica se a request é de um admin. Útil pra gatear APIs sensíveis.
 */
export function isAdmin(request: NextRequest): boolean {
  return getAuthUser(request)?.role === 'admin'
}

/**
 * Retorna o usuário autenticado ou lança erro se não for admin.
 * Usado no topo de APIs /api/admin/** e /api/users/**.
 */
export function requireAdmin(request: NextRequest): AuthUser {
  const user = getAuthUser(request)
  if (!user || user.role !== 'admin') {
    throw new AuthError('Admin access required', 403)
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
