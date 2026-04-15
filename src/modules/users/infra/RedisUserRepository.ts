/**
 * RedisUserRepository — adapter que envelopa as funções legadas de
 * `@/lib/users.ts` no contrato `UserRepository`.
 *
 * **Existe APENAS para a fase de migração** (M4). Quando o
 * `USE_POSTGRES_USERS` flag estiver global e estável por 30+ dias,
 * este arquivo é removido junto com o caminho legado.
 *
 * Não importa @/lib/users.ts diretamente quando puder evitar — usa
 * Redis client diretamente para operações simples (mais previsível
 * em retries de teste). Funções com lógica complexa (hash de senha,
 * validação de email no create) ficam só no caminho legado e este
 * adapter foca em CRUD básico.
 */

import { getRedis } from '@/lib/redis'
import type { User, UserRole, UserStatus } from '../domain/User'
import { validateUser } from '../domain/User'
import type {
  UserRepository,
  UserListFilter,
} from '../ports/UserRepository'

const USER_PREFIX = 'aaz:user:'
const USER_EMAIL_INDEX = 'aaz:user_email:'

interface RedisUserShape {
  id: string
  email: string
  name: string
  role: string
  status?: string
  passwordHash: string
  monthlyBudgetUsd?: number
  assignedProjectIds?: string[]
  organizationId?: string
  permissions?: string[]
  products?: string[]
  createdAt?: string
  lastActiveAt?: string
  createdBy?: string
}

function fromRedis(raw: string): User | null {
  try {
    const obj = JSON.parse(raw) as RedisUserShape
    return validateUser({
      id: obj.id,
      email: obj.email,
      name: obj.name,
      role: obj.role as UserRole,
      status: (obj.status as UserStatus | undefined) ?? 'active',
      passwordHash: obj.passwordHash,
      monthlyBudgetUsd: obj.monthlyBudgetUsd,
      assignedProjectIds: obj.assignedProjectIds ?? [],
      organizationId: obj.organizationId ?? null,
      permissions: obj.permissions ?? [],
      products: obj.products ?? [],
      createdAt: obj.createdAt,
      lastActiveAt: obj.lastActiveAt,
      createdBy: obj.createdBy ?? 'system',
    })
  } catch (err) {
    console.error('[RedisUserRepository] corrupt JSON', err)
    return null
  }
}

function toRedis(user: User): string {
  // Mantém o shape legado — `assignedProjectIds`/`permissions`/`products`
  // são opcionais no schema antigo (poderiam estar undefined).
  return JSON.stringify({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    passwordHash: user.passwordHash,
    monthlyBudgetUsd: user.monthlyBudgetUsd,
    assignedProjectIds: user.assignedProjectIds,
    organizationId: user.organizationId ?? undefined,
    permissions: user.permissions,
    products: user.products,
    createdAt: user.createdAt,
    lastActiveAt: user.lastActiveAt,
    createdBy: user.createdBy,
  })
}

export class RedisUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const redis = await getRedis()
    const raw = await redis.get(`${USER_PREFIX}${id}`)
    return raw ? fromRedis(raw) : null
  }

  async findByEmail(email: string): Promise<User | null> {
    const redis = await getRedis()
    const id = await redis.get(
      `${USER_EMAIL_INDEX}${email.trim().toLowerCase()}`,
    )
    if (!id) return null
    return this.findById(id)
  }

  async list(filter?: UserListFilter): Promise<User[]> {
    const redis = await getRedis()
    const keys = await redis.keys(`${USER_PREFIX}*`)
    // Filtra chaves que não são realmente users (índices secundários, etc).
    const userKeys = keys.filter((k) => !k.startsWith(USER_EMAIL_INDEX))

    const users: User[] = []
    for (const key of userKeys) {
      const raw = await redis.get(key)
      if (!raw) continue
      const u = fromRedis(raw)
      if (!u) continue

      if (filter?.organizationId === null && u.organizationId !== null) continue
      if (
        typeof filter?.organizationId === 'string' &&
        u.organizationId !== filter.organizationId
      ) {
        continue
      }
      if (filter?.role && u.role !== filter.role) continue
      if (filter?.status && u.status !== filter.status) continue

      users.push(u)
    }

    users.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (filter?.limit && filter.limit > 0) return users.slice(0, filter.limit)
    return users
  }

  async upsert(user: User): Promise<User> {
    const validated = validateUser(user)
    const redis = await getRedis()

    // Garante consistência do email index — se mudou, expurga o anterior.
    const prevRaw = await redis.get(`${USER_PREFIX}${validated.id}`)
    if (prevRaw) {
      const prev = fromRedis(prevRaw)
      if (prev && prev.email !== validated.email) {
        await redis.del(`${USER_EMAIL_INDEX}${prev.email}`)
      }
    }

    // Verifica conflito de email com outro id
    const conflictId = await redis.get(`${USER_EMAIL_INDEX}${validated.email}`)
    if (conflictId && conflictId !== validated.id) {
      throw new Error(
        `Email ${validated.email} já pertence ao user ${conflictId}`,
      )
    }

    await redis.set(`${USER_PREFIX}${validated.id}`, toRedis(validated))
    await redis.set(`${USER_EMAIL_INDEX}${validated.email}`, validated.id)
    return validated
  }

  async remove(id: string): Promise<void> {
    const redis = await getRedis()
    const raw = await redis.get(`${USER_PREFIX}${id}`)
    if (raw) {
      const u = fromRedis(raw)
      if (u) await redis.del(`${USER_EMAIL_INDEX}${u.email}`)
    }
    await redis.del(`${USER_PREFIX}${id}`)
  }

  async touchLastActive(id: string, at: Date = new Date()): Promise<void> {
    const u = await this.findById(id)
    if (!u) return
    const updated = { ...u, lastActiveAt: at.toISOString() }
    const redis = await getRedis()
    await redis.set(`${USER_PREFIX}${id}`, toRedis(updated))
  }
}
