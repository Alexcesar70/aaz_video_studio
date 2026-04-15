/**
 * User — entidade de domínio.
 *
 * Espelha o shape atual em `@/lib/users.ts` (Redis), mas com validação
 * pura e sem dependência de infra. A migração pra Postgres (M3-PR2)
 * usa este domain como única fonte da verdade — o Postgres adapter
 * traduz `UserRow` ↔ `User`, e o Redis adapter idem.
 *
 * Regras invariantes:
 *   - id: slug não-vazio, [a-z0-9_-]+
 *   - email: string não-vazia (validação de formato é soft — delegada
 *     ao caller se precisar ser estrita; SQL garante unicidade)
 *   - role: union tipado
 *   - status: active | revoked
 *   - permissions[] e products[] são arrays (nunca undefined)
 *   - passwordHash é obrigatório mas omitido em `PublicUser`
 */

export type UserRole = 'super_admin' | 'admin' | 'creator'
export const USER_ROLES: readonly UserRole[] = [
  'super_admin',
  'admin',
  'creator',
] as const

export type UserStatus = 'active' | 'revoked'
export const USER_STATUSES: readonly UserStatus[] = [
  'active',
  'revoked',
] as const

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  status: UserStatus
  passwordHash: string
  monthlyBudgetUsd?: number
  assignedProjectIds: string[]
  organizationId: string | null
  permissions: string[]
  products: string[]
  createdAt: string // ISO 8601
  lastActiveAt?: string
  createdBy: string
}

/** Shape sem o hash — safe pra responder em APIs públicas. */
export type PublicUser = Omit<User, 'passwordHash'>

export class InvalidUserError extends Error {
  constructor(message: string) {
    super(`Invalid User: ${message}`)
    this.name = 'InvalidUserError'
  }
}

const ID_REGEX = /^[a-z0-9_-]+$/

export function validateUser(input: Partial<User>): User {
  if (!input.id || typeof input.id !== 'string') {
    throw new InvalidUserError('id é obrigatório')
  }
  if (!ID_REGEX.test(input.id)) {
    throw new InvalidUserError(
      `id inválido "${input.id}" — use só [a-z0-9_-]`,
    )
  }
  if (typeof input.email !== 'string' || input.email.trim().length === 0) {
    throw new InvalidUserError('email é obrigatório')
  }
  if (typeof input.name !== 'string' || input.name.trim().length === 0) {
    throw new InvalidUserError('name é obrigatório')
  }
  if (!input.role || !USER_ROLES.includes(input.role)) {
    throw new InvalidUserError(`role inválido: ${String(input.role)}`)
  }
  if (!input.status || !USER_STATUSES.includes(input.status)) {
    throw new InvalidUserError(`status inválido: ${String(input.status)}`)
  }
  if (typeof input.passwordHash !== 'string' || input.passwordHash.length === 0) {
    throw new InvalidUserError('passwordHash é obrigatório')
  }
  if (
    input.monthlyBudgetUsd !== undefined &&
    (typeof input.monthlyBudgetUsd !== 'number' || input.monthlyBudgetUsd < 0)
  ) {
    throw new InvalidUserError('monthlyBudgetUsd deve ser número >= 0')
  }
  if (
    input.organizationId !== null &&
    input.organizationId !== undefined &&
    (typeof input.organizationId !== 'string' || input.organizationId.length === 0)
  ) {
    throw new InvalidUserError('organizationId deve ser string ou null')
  }

  const now = new Date().toISOString()
  return {
    id: input.id,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    role: input.role,
    status: input.status,
    passwordHash: input.passwordHash,
    monthlyBudgetUsd: input.monthlyBudgetUsd,
    assignedProjectIds: input.assignedProjectIds ?? [],
    organizationId: input.organizationId ?? null,
    permissions: input.permissions ?? [],
    products: input.products ?? [],
    createdAt: input.createdAt ?? now,
    lastActiveAt: input.lastActiveAt,
    createdBy: input.createdBy ?? 'system',
  }
}

/** Retorna User sem o passwordHash — nunca serializar User diretamente em API. */
export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _drop, ...rest } = user
  void _drop
  return rest
}
