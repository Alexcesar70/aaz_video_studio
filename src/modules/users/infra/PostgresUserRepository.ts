import { eq, and, desc, type SQL } from 'drizzle-orm'
import type { User } from '../domain/User'
import { validateUser, type UserRole, type UserStatus } from '../domain/User'
import type {
  UserRepository,
  UserListFilter,
} from '../ports/UserRepository'
import { getDb, type Db } from '@/db/client'
import { users, type UserRow, type UserInsert } from '@/db/schema'

/**
 * Repository Postgres para User (via Drizzle).
 *
 * Mapeia linhas do schema `users` para o domain `User`, e vice-versa.
 * Não faz cache — cada chamada é uma query. Cache é responsabilidade
 * de quem quiser (geralmente não vale a pena para user — data quente
 * vive no JWT).
 *
 * Em ambiente sem DATABASE_URL (testes locais sem DB), `getDb()`
 * lança. Prefira `InMemoryUserRepository` em tests unit.
 */
export class PostgresUserRepository implements UserRepository {
  private readonly _injectedDb?: Db

  constructor(db?: Db) {
    this._injectedDb = db
  }

  /**
   * Resolve `db` no primeiro uso — permite construir o repo em
   * ambientes sem DATABASE_URL (ex.: composer/seleção por flag em
   * testes que só checam tipo). Em runtime real, falha somente quando
   * uma operação é executada.
   */
  private get db(): Db {
    return this._injectedDb ?? getDb()
  }

  async findById(id: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
    return rows[0] ? rowToUser(rows[0]) : null
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.trim().toLowerCase()
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, normalized))
      .limit(1)
    return rows[0] ? rowToUser(rows[0]) : null
  }

  async list(filter?: UserListFilter): Promise<User[]> {
    const conds: SQL[] = []
    if (filter?.organizationId === null) {
      // Postgres: NULL equality needs IS NULL; eq() produz "= NULL" que
      // é sempre UNKNOWN. Para filtrar "orgId null", usamos sql`IS NULL`.
      // Drizzle tem `isNull` helper.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isNull } = await import('drizzle-orm')
      conds.push(isNull(users.organizationId))
    } else if (typeof filter?.organizationId === 'string') {
      conds.push(eq(users.organizationId, filter.organizationId))
    }
    if (filter?.role) conds.push(eq(users.role, filter.role))
    if (filter?.status) conds.push(eq(users.status, filter.status))

    const baseQuery = this.db.select().from(users).orderBy(desc(users.createdAt))
    const q = conds.length > 0 ? baseQuery.where(and(...conds)!) : baseQuery
    const limited = filter?.limit && filter.limit > 0 ? q.limit(filter.limit) : q

    const rows = await limited
    return rows.map(rowToUser)
  }

  async upsert(user: User): Promise<User> {
    const validated = validateUser(user)
    const insert = userToInsert(validated)

    const updateSet: Partial<UserInsert> = {
      email: insert.email,
      name: insert.name,
      role: insert.role,
      status: insert.status,
      passwordHash: insert.passwordHash,
      monthlyBudgetUsd: insert.monthlyBudgetUsd,
      assignedProjectIds: insert.assignedProjectIds,
      organizationId: insert.organizationId,
      permissions: insert.permissions,
      products: insert.products,
      lastActiveAt: insert.lastActiveAt,
    }

    await this.db
      .insert(users)
      .values(insert)
      .onConflictDoUpdate({ target: users.id, set: updateSet })

    return validated
  }

  async remove(id: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id))
  }

  async touchLastActive(id: string, at: Date = new Date()): Promise<void> {
    await this.db
      .update(users)
      .set({ lastActiveAt: at })
      .where(eq(users.id, id))
  }
}

/** Mapper: linha do DB → entidade de domínio. */
export function rowToUser(row: UserRow): User {
  return validateUser({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as UserRole,
    status: row.status as UserStatus,
    passwordHash: row.passwordHash,
    monthlyBudgetUsd:
      row.monthlyBudgetUsd !== null ? Number(row.monthlyBudgetUsd) : undefined,
    assignedProjectIds: row.assignedProjectIds,
    organizationId: row.organizationId,
    permissions: row.permissions,
    products: row.products,
    createdAt: row.createdAt.toISOString(),
    lastActiveAt: row.lastActiveAt?.toISOString(),
    createdBy: row.createdBy,
  })
}

/** Mapper: entidade de domínio → insert shape do Drizzle. */
export function userToInsert(user: User): UserInsert {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    passwordHash: user.passwordHash,
    monthlyBudgetUsd:
      user.monthlyBudgetUsd !== undefined
        ? String(user.monthlyBudgetUsd)
        : null,
    assignedProjectIds: user.assignedProjectIds,
    organizationId: user.organizationId,
    permissions: user.permissions,
    products: user.products,
    createdAt: new Date(user.createdAt),
    lastActiveAt: user.lastActiveAt ? new Date(user.lastActiveAt) : null,
    createdBy: user.createdBy,
  }
}
