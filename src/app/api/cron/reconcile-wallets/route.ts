/**
 * GET /api/cron/reconcile-wallets — invocado pelo Vercel Cron diário
 * (03:00 UTC, ver vercel.json).
 *
 * Lógica equivalente ao `scripts/reconcile/wallets.ts` mas como rota
 * HTTP (Vercel Cron exige endpoint, não comando standalone).
 *
 * Auth: o Vercel injeta `Authorization: Bearer <CRON_SECRET>` quando
 * configurado. Validamos pra rejeitar requests externos.
 *
 * Output:
 *   200 { type: 'wallet_reconcile_report', ... }
 *   401 { error: 'Unauthorized' }
 *   500 { error: '...' }
 *
 * Esta rota só faz sentido quando a fase de dual-write da Wallet
 * está ativa. Antes disso, retorna report mostrando que Postgres
 * está vazio (ainda não há backfill) — não é "erro", é estado
 * esperado.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/redis'
import { getDb } from '@/db/client'
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

const PRECISION = 4
function round(n: number): number {
  const f = Math.pow(10, PRECISION)
  return Math.round(n * f) / f
}

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: NextRequest) {
  // Vercel Cron auth — opcional mas recomendado em prod
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const redis = await getRedis()
    const db = getDb()

    // Fetch Redis wallets
    const keys = await redis.keys('aaz:wallet:*')
    const walletKeys = keys.filter(
      (k) =>
        !k.startsWith('aaz:wallet_txn:') &&
        !k.startsWith('aaz:wallet_owner:'),
    )
    const redisMap = new Map<string, RedisWalletShape>()
    for (const key of walletKeys) {
      const raw = await redis.get(key)
      if (!raw) continue
      try {
        const w = JSON.parse(raw) as RedisWalletShape
        redisMap.set(w.id, w)
      } catch {
        // ignora corrompido
      }
    }

    // Fetch Postgres wallets
    const pgRows = await db.select().from(wallets)
    const pgMap = new Map<
      string,
      { id: string; ownerId: string; balanceUsd: number; totalTopUps: number; totalSpent: number }
    >()
    for (const row of pgRows) {
      pgMap.set(row.id, {
        id: row.id,
        ownerId: row.ownerId,
        balanceUsd: Number(row.balanceUsd),
        totalTopUps: Number(row.totalTopUps),
        totalSpent: Number(row.totalSpent),
      })
    }

    // Compare
    const missingInPostgres: string[] = []
    const missingInRedis: string[] = []
    const balanceDiffs: Array<{
      id: string
      ownerId: string
      redis: number
      postgres: number
      delta: number
      field: 'balanceUsd' | 'totalTopUps' | 'totalSpent'
    }> = []

    Array.from(redisMap.entries()).forEach(([id, rw]) => {
      const pw = pgMap.get(id)
      if (!pw) {
        missingInPostgres.push(id)
        return
      }
      for (const field of [
        'balanceUsd',
        'totalTopUps',
        'totalSpent',
      ] as const) {
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

    const hasDivergence =
      missingInPostgres.length > 0 ||
      missingInRedis.length > 0 ||
      balanceDiffs.length > 0

    const report = {
      type: 'wallet_reconcile_report',
      redis_count: redisMap.size,
      postgres_count: pgMap.size,
      missing_in_postgres: missingInPostgres,
      missing_in_redis: missingInRedis,
      balance_diffs: balanceDiffs,
      ts: new Date().toISOString(),
    }

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

    return NextResponse.json(report, {
      status: hasDivergence ? 200 : 200, // sempre 200 — divergência vai pra Sentry
    })
  } catch (err) {
    reportError(err, {
      tags: { feature: 'wallet_reconcile', severity: 'fatal' },
    })
    console.error('[/api/cron/reconcile-wallets]', err)
    const message = err instanceof Error ? err.message : 'Erro interno.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
