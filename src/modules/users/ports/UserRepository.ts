import type { User, UserRole, UserStatus } from '../domain/User'

export interface UserListFilter {
  organizationId?: string | null
  role?: UserRole
  status?: UserStatus
  limit?: number
}

/**
 * Contrato de persistência de User.
 *
 * Implementações:
 *   - infra/PostgresUserRepository (M3+ produção)
 *   - infra/InMemoryUserRepository (testes)
 *   - infra/RedisUserRepository (legado; coexiste durante migração)
 *
 * Regra: retornos incluem passwordHash. A rota que expõe ao browser
 * é responsável por usar `toPublicUser()` antes de serializar.
 */
export interface UserRepository {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  list(filter?: UserListFilter): Promise<User[]>
  upsert(user: User): Promise<User>
  remove(id: string): Promise<void>

  /** Atualiza apenas `lastActiveAt`. Chamado no middleware de auth. */
  touchLastActive(id: string, at?: Date): Promise<void>
}
