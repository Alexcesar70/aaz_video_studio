import type { User } from '../domain/User'
import { validateUser, type UserRole, type UserStatus } from '../domain/User'
import type { UserRepository } from '../ports/UserRepository'

export interface UpsertUserInput {
  id: string
  email: string
  name: string
  role: UserRole
  status?: UserStatus
  passwordHash: string
  monthlyBudgetUsd?: number
  assignedProjectIds?: string[]
  organizationId?: string | null
  permissions?: string[]
  products?: string[]
  createdBy?: string
  createdAt?: string
  lastActiveAt?: string
}

/**
 * Idempotente: cria ou atualiza. A validação é estrita; emails duplicados
 * são rejeitados pela unique constraint do Postgres (a camada vem de
 * `UserRepository.upsert`).
 */
export async function upsertUser(
  deps: { repo: UserRepository },
  input: UpsertUserInput,
): Promise<User> {
  const user = validateUser({
    id: input.id,
    email: input.email,
    name: input.name,
    role: input.role,
    status: input.status ?? 'active',
    passwordHash: input.passwordHash,
    monthlyBudgetUsd: input.monthlyBudgetUsd,
    assignedProjectIds: input.assignedProjectIds ?? [],
    organizationId: input.organizationId ?? null,
    permissions: input.permissions ?? [],
    products: input.products ?? [],
    createdAt: input.createdAt,
    lastActiveAt: input.lastActiveAt,
    createdBy: input.createdBy,
  })
  return deps.repo.upsert(user)
}
