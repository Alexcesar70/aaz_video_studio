/**
 * Reconciliation script — Wallet (Redis vs Postgres).
 *
 * Roda durante a fase de dual-write (M4-PR4 + M5-PR3) para detectar
 * divergências silenciosas: wallets que existem em um store mas não
 * no outro, ou que têm `balanceUsd`/`totalTopUps`/`totalSpent`
 * diferentes.
 *
 * Quando rodar:
 *   - Diariamente (Vercel Cron) durante dual-write.
 *   - On-demand antes de virar `USE_POSTGRES_WALLET=on`.
 *
 * Como rodar local:
 *   npx tsx scripts/reconcile/wallets.ts
 *
 * Saída em JSON estruturado (pra log shipper):
 *   {
 *     "type": "wallet_reconcile_report",
 *     "redis_count": 12,
 *     "postgres_count": 12,
 *     "missing_in_postgres": [],
 *     "missing_in_redis": [],
 *     "balance_diffs": [{ id, redis: 10.50, postgres: 10.49, delta: 0.01 }],
 *     "ts": "..."
 *   }
 *
 * Exit code:
 *   - 0: sem divergências (zero entries em todas as listas).
 *   - 1: divergências encontradas → reporta via reportError + exit 1.
 *   - 2: erro fatal (Redis ou DB inacessível).
 */

import { eq } from 'drizzle-orm'
import { getRedis } from '@/lib/redis'
import { getDb, closeDb } from '@/db/client'
import { wallets } from '@/db/schema'
import { reportError } from '@/lib/errorReporter'

interface RedisWalletShape {
  id: string
  ownerId: string
  ownerType: 'organization' | 'user'
  balanceUsd: number
  totalTopUps: number
  totalSpent: number
}

interface BalanceDiff {
  id: string
  ownerId: string
  redis: number
  postgres: number
  delta: number
  field: 'balanceUsd' | 'totalTopUps' | 'totalSpent'
}

const PRECISION = 4
function round(n: number): number {
  const f = Math.pow(10, PRECISION)
  return Math.round(n * f) / f
}

async function fetchRedisWallets(): Promise<Map<string, RedisWalletShape>> {
  const redis = await getRedis()
  const keys = await redis.keys('aaz:wallet:*')
  // Filtra chaves auxiliares (sorted sets de txn, owner index)
  const walletKeys = keys.filter(
    (k) =>
      !k.startsWith('aaz:wallet_txn:') && !k.startsWith('aaz:wallet_owner:'),
  )
  const out = new Map<string, RedisWalletShape>()
  for (const key of walletKeys) {
    const raw = await redis.get(key)
    if (!raw) continue
    try {
      const w = JSON.parse(raw) as RedisWalletShape
      out.set(w.id, w)
    } catch {
      // ignora corrompido
    }
  }
  return out
}

async function fetchPostgresWallets(): Promise<
  Map<
    string,
    { id: string; ownerId: string; balanceUsd: number; totalTopUps: number; totalSpent: number }
  >
> {
  const db = getDb()
  const rows = await db.select().from(wallets)
  const out = new Map<
    string,
    { id: string; ownerId: string; balanceUsd: number; totalTopUps: number; totalSpent: number }
  >()
  for (const row of rows) {
    out.set(row.id, {
      id: row.id,
      ownerId: row.ownerId,
      balanceUsd: Number(row.balanceUsd),
      totalTopUps: Number(row.totalTopUps),
      totalSpent: Number(row.totalSpent),
    })
  }
  return out
}

async function run() {
  const [redisMap, pgMap] = await Promise.all([
    fetchRedisWallets(),
    fetchPostgresWallets(),
  ])

  const missingInPostgres: string[] = []
  const missingInRedis: string[] = []
  const balanceDiffs: BalanceDiff[] = []

  Array.from(redisMap.entries()).forEach(([id, rw]) => {
    const pw = pgMap.get(id)
    if (!pw) {
      missingInPostgres.push(id)
      return
    }
    for (const field of ['balanceUsd', 'totalTopUps', 'totalSpent'] as const) {
      const r = round(rw[field])
      const p = round(pw[field])
      if (r !== p) {
        balanceDiffs.push({
          id,
          ownerId: rw.ownerId,
          redis: r,
          postgres: p,
          delta: round(r - p),
          field,
        })
      }
    }
  })

  Array.from(pgMap.keys()).forEach((id) => {
    if (!redisMap.has(id)) missingInRedis.push(id)
  })

  const report = {
    type: 'wallet_reconcile_report',
    redis_count: redisMap.size,
    postgres_count: pgMap.size,
    missing_in_postgres: missingInPostgres,
    missing_in_redis: missingInRedis,
    balance_diffs: balanceDiffs,
    ts: new Date().toISOString(),
  }
  console.log(JSON.stringify(report))

  const hasDivergence =
    missingInPostgres.length > 0 ||
    missingInRedis.length > 0 ||
    balanceDiffs.length > 0

  if (hasDivergence) {
    reportError(
      new Error('Wallet reconciliation found divergences'),
      {
        tags: { feature: 'wallet_reconcile', severity: 'critical' },
        extra: {
          missing_in_postgres: missingInPostgres.length,
          missing_in_redis: missingInRedis.length,
          balance_diffs: balanceDiffs.length,
        },
        fingerprint: ['wallet-reconcile', 'divergence'],
      },
    )
  }

  await closeDb()
  process.exit(hasDivergence ? 1 : 0)
}

run().catch((err) => {
  console.error('[reconcile/wallets] fatal:', err)
  reportError(err, {
    tags: { feature: 'wallet_reconcile', severity: 'fatal' },
  })
  process.exit(2)
})

// Avoid unused import warning when using `eq` only conceptually.
void eq
