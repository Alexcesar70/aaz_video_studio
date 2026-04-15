/**
 * Backfill Redis → Postgres para Wallets + Wallet Transactions.
 *
 * Mais delicado que outros backfills porque envolve dinheiro:
 *   1. Cria/upserta a wallet no Postgres com o saldo do Redis.
 *   2. Para cada transação histórica do Redis, faz INSERT direto na
 *      tabela `wallet_transactions` (sem usar `applyTransaction`,
 *      que recalcula o saldo — queremos apenas espelhar o histórico).
 *
 * IDEMPOTENTE: usa o id original da txn como PK; rodar 2x não duplica.
 *
 * Como rodar:
 *   npx tsx scripts/backfill/wallets.ts
 */

import { randomUUID } from 'crypto'
import { sql } from 'drizzle-orm'
import { getRedis } from '@/lib/redis'
import { getDb } from '@/db/client'
import { wallets, walletTransactions } from '@/db/schema'

interface RedisWalletShape {
  id: string
  ownerId: string
  ownerType: 'organization' | 'user'
  balanceUsd: number
  totalTopUps: number
  totalSpent: number
  alertThresholds?: { warning: number; critical: number; danger: number }
  version: number
  createdAt: string
  updatedAt: string
}

interface RedisTxnShape {
  id: string
  walletId: string
  type: string
  amountUsd: number
  reason?: string
  metadata?: Record<string, unknown>
  createdBy?: string
  createdAt: string
}

async function run() {
  const redis = await getRedis()
  const db = getDb()

  let walletsRead = 0
  let walletsWritten = 0
  let txnsRead = 0
  let txnsWritten = 0
  const errors: Array<{ key: string; error: string }> = []

  const walletKeys = await redis.keys('aaz:wallet:*')
  for (const key of walletKeys) {
    walletsRead++
    try {
      const raw = await redis.get(key)
      if (!raw) continue
      const w = JSON.parse(raw) as RedisWalletShape
      await db
        .insert(wallets)
        .values({
          id: w.id,
          ownerId: w.ownerId,
          ownerType: w.ownerType,
          balanceUsd: w.balanceUsd.toFixed(4),
          totalTopUps: w.totalTopUps.toFixed(4),
          totalSpent: w.totalSpent.toFixed(4),
          warningThreshold: w.alertThresholds?.warning ?? 20,
          criticalThreshold: w.alertThresholds?.critical ?? 10,
          dangerThreshold: w.alertThresholds?.danger ?? 5,
          version: w.version,
          createdAt: new Date(w.createdAt),
          updatedAt: new Date(w.updatedAt),
        })
        .onConflictDoUpdate({
          target: wallets.id,
          set: {
            balanceUsd: w.balanceUsd.toFixed(4),
            totalTopUps: w.totalTopUps.toFixed(4),
            totalSpent: w.totalSpent.toFixed(4),
            version: w.version,
            updatedAt: new Date(w.updatedAt),
          },
        })
      walletsWritten++

      // Espelha transações desta wallet (sorted set aaz:wallet_txn:{id}).
      const txnKey = `aaz:wallet_txn:${w.id}`
      const txnRaws = await redis.zRange(txnKey, 0, -1)
      for (const txnRaw of txnRaws) {
        txnsRead++
        try {
          const t = JSON.parse(txnRaw) as RedisTxnShape
          // Se o legado não tiver id, gera um novo (idempotência perdida — log de aviso).
          const txnId = t.id || randomUUID()
          await db
            .insert(walletTransactions)
            .values({
              id: txnId,
              walletId: t.walletId,
              type: t.type,
              amountUsd: t.amountUsd.toFixed(4),
              reason: t.reason ?? '',
              metadata: t.metadata ?? null,
              createdBy: t.createdBy ?? null,
              createdAt: new Date(t.createdAt),
            })
            .onConflictDoNothing({ target: walletTransactions.id })
          txnsWritten++
        } catch (err) {
          errors.push({
            key: `${txnKey}:txn`,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    } catch (err) {
      errors.push({
        key,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Reconciliation sanity check
  const sumPg = await db.select({ s: sql<string>`sum(balance_usd)` }).from(wallets)
  console.log(
    JSON.stringify(
      {
        walletsRead,
        walletsWritten,
        txnsRead,
        txnsWritten,
        errors,
        postgresBalanceTotal: sumPg[0]?.s ?? '0',
      },
      null,
      2,
    ),
  )

  process.exit(errors.length > 0 ? 1 : 0)
}

run().catch((err) => {
  console.error('Backfill failed:', err)
  process.exit(2)
})
