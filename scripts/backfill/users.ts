/**
 * Backfill Redis → Postgres para Users.
 *
 * IDEMPOTENTE: executar 2x não duplica nada. Cada user é normalizado
 * pelo `validateUser` antes do upsert. Linhas pré-existentes no
 * Postgres com mesmo `id` são sobrescritas (ON CONFLICT DO UPDATE).
 *
 * Como rodar (com DATABASE_URL e REDIS_URL setados):
 *   npx tsx scripts/backfill/users.ts
 *
 * Saída:
 *   { read: 47, written: 47, errors: 0, examples: [...] }
 *
 * SAFETY:
 *   - Não apaga nada do Redis.
 *   - Não muda comportamento de produção (apenas popula uma tabela
 *     que ainda não está sendo lida pelo runtime).
 *   - Pode rodar em horário de tráfego.
 */

import { getRedis } from '@/lib/redis'
import {
  PostgresUserRepository,
  validateUser,
  type User,
  type UserRole,
  type UserStatus,
} from '@/modules/users'

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

interface BackfillResult {
  read: number
  written: number
  skipped: number
  errors: Array<{ id: string; error: string }>
}

async function run(): Promise<BackfillResult> {
  const redis = await getRedis()
  const repo = new PostgresUserRepository()

  const keys = await redis.keys('aaz:user:*')
  // Filtra apenas chaves user (não índices secundários como aaz:user_email:)
  const userKeys = keys.filter((k) => !k.startsWith('aaz:user_email:'))

  const result: BackfillResult = { read: 0, written: 0, skipped: 0, errors: [] }

  for (const key of userKeys) {
    result.read++
    try {
      const raw = await redis.get(key)
      if (!raw) {
        result.skipped++
        continue
      }
      const obj = JSON.parse(raw) as RedisUserShape
      const user: User = validateUser({
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
        createdBy: obj.createdBy,
      })
      await repo.upsert(user)
      result.written++
    } catch (err) {
      result.errors.push({
        id: key,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return result
}

run()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2))
    process.exit(r.errors.length > 0 ? 1 : 0)
  })
  .catch((err) => {
    console.error('Backfill failed:', err)
    process.exit(2)
  })
