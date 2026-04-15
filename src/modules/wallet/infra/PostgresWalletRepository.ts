import { randomUUID } from 'crypto'
import { and, desc, eq, type SQL } from 'drizzle-orm'
import type {
  Wallet,
  WalletTransaction,
  WalletOwnerType,
  AlertThresholds,
} from '../domain/Wallet'
import {
  DEFAULT_ALERT_THRESHOLDS,
  computeSignedDelta,
  validateWallet,
  validateWalletTransaction,
  InsufficientBalanceError,
} from '../domain/Wallet'
import type {
  WalletRepository,
  CreateWalletInput,
  ApplyTransactionInput,
  ApplyTransactionResult,
  TransferInput,
  TransferResult,
  ListTransactionsFilter,
} from '../ports/WalletRepository'
import { getDb, type Db } from '@/db/client'
import {
  wallets,
  walletTransactions,
  type WalletRow,
  type WalletInsert,
  type WalletTransactionRow,
  type WalletTransactionInsert,
} from '@/db/schema'

/**
 * Repository Postgres — ACID via `db.transaction()`.
 *
 * **Pontos delicados:**
 * 1. `applyTransaction` usa `SELECT ... FOR UPDATE` (via row lock na
 *    wallet dentro da tx) para evitar que duas requests concorrentes
 *    leiam o mesmo `version` e ambas pretendam debitar. Só uma passa.
 * 2. CHECK constraint `balance_usd >= 0` no schema é safety net
 *    final — mesmo que a lógica acima falhasse por bug, o DB rejeita.
 * 3. `version` incrementa a cada update — optimistic lock opcional
 *    para callers que querem protecção extra.
 */
export class PostgresWalletRepository implements WalletRepository {
  private readonly _injectedDb?: Db

  constructor(db?: Db) {
    this._injectedDb = db
  }

  private get db(): Db {
    return this._injectedDb ?? getDb()
  }

  async findById(id: string): Promise<Wallet | null> {
    const rows = await this.db
      .select()
      .from(wallets)
      .where(eq(wallets.id, id))
      .limit(1)
    return rows[0] ? rowToWallet(rows[0]) : null
  }

  async findByOwner(
    ownerType: WalletOwnerType,
    ownerId: string,
  ): Promise<Wallet | null> {
    const rows = await this.db
      .select()
      .from(wallets)
      .where(
        and(eq(wallets.ownerType, ownerType), eq(wallets.ownerId, ownerId))!,
      )
      .limit(1)
    return rows[0] ? rowToWallet(rows[0]) : null
  }

  async create(input: CreateWalletInput): Promise<Wallet> {
    // Idempotência: se já existe wallet pro owner, retorna.
    const existing = await this.findByOwner(input.ownerType, input.ownerId)
    if (existing) return existing

    const now = new Date()
    const wallet = validateWallet({
      id: input.id ?? randomUUID(),
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      balanceUsd: 0,
      totalTopUps: 0,
      totalSpent: 0,
      alertThresholds: input.alertThresholds ?? DEFAULT_ALERT_THRESHOLDS,
      version: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })

    const insert: WalletInsert = {
      id: wallet.id,
      ownerId: wallet.ownerId,
      ownerType: wallet.ownerType,
      balanceUsd: wallet.balanceUsd.toFixed(4),
      totalTopUps: wallet.totalTopUps.toFixed(4),
      totalSpent: wallet.totalSpent.toFixed(4),
      warningThreshold: wallet.alertThresholds.warning,
      criticalThreshold: wallet.alertThresholds.critical,
      dangerThreshold: wallet.alertThresholds.danger,
      version: wallet.version,
      createdAt: now,
      updatedAt: now,
    }
    await this.db.insert(wallets).values(insert)
    return wallet
  }

  async applyTransaction(
    input: ApplyTransactionInput,
  ): Promise<ApplyTransactionResult> {
    return this.db.transaction(async (tx) => {
      // SELECT FOR UPDATE bloqueia a row até o fim desta transaction.
      // postgres-js + drizzle: construímos via .for('update').
      const rows = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.id, input.walletId))
        .for('update')
        .limit(1)
      const row = rows[0]
      if (!row) throw new Error(`Wallet not found: ${input.walletId}`)

      const current = rowToWallet(row)

      if (
        input.expectedVersion !== undefined &&
        current.version !== input.expectedVersion
      ) {
        throw new Error(
          `Wallet version mismatch: expected ${input.expectedVersion}, got ${current.version}`,
        )
      }

      const delta = computeSignedDelta(
        input.type,
        input.amountUsd,
        input.signedDelta,
      )
      const newBalance = round4(current.balanceUsd + delta)
      if (newBalance < 0) {
        throw new InsufficientBalanceError(
          current.balanceUsd,
          Math.abs(delta),
        )
      }

      const now = new Date()
      const updatedDomain: Wallet = {
        ...current,
        balanceUsd: newBalance,
        totalTopUps:
          delta > 0 && input.type !== 'adjustment'
            ? round4(current.totalTopUps + input.amountUsd)
            : current.totalTopUps,
        totalSpent:
          delta < 0 && input.type !== 'adjustment'
            ? round4(current.totalSpent + input.amountUsd)
            : current.totalSpent,
        version: current.version + 1,
        updatedAt: now.toISOString(),
      }

      await tx
        .update(wallets)
        .set({
          balanceUsd: updatedDomain.balanceUsd.toFixed(4),
          totalTopUps: updatedDomain.totalTopUps.toFixed(4),
          totalSpent: updatedDomain.totalSpent.toFixed(4),
          version: updatedDomain.version,
          updatedAt: now,
        })
        .where(eq(wallets.id, input.walletId))

      const txn = validateWalletTransaction({
        id: randomUUID(),
        walletId: input.walletId,
        type: input.type,
        amountUsd: input.amountUsd,
        signedDelta: input.type === 'adjustment' ? delta : undefined,
        reason: input.reason ?? '',
        metadata: input.metadata,
        createdBy: input.createdBy,
        createdAt: now.toISOString(),
      })

      const txnInsert: WalletTransactionInsert = {
        id: txn.id,
        walletId: txn.walletId,
        type: txn.type,
        amountUsd: txn.amountUsd.toFixed(4),
        reason: txn.reason,
        metadata: txn.metadata ?? null,
        createdBy: txn.createdBy ?? null,
        createdAt: now,
      }
      await tx.insert(walletTransactions).values(txnInsert)

      return { wallet: updatedDomain, transaction: txn }
    })
  }

  async transfer(input: TransferInput): Promise<TransferResult> {
    if (input.fromWalletId === input.toWalletId) {
      throw new Error('Cannot transfer to same wallet')
    }
    if (input.amountUsd <= 0) {
      throw new Error('Transfer amount must be positive')
    }
    // Executa DENTRO de uma única transaction DB — se qualquer side
    // falha, rollback automático.
    return this.db.transaction(async (tx) => {
      // Recursa no mesmo tx por composição: criamos um PostgresWalletRepository
      // "provisório" usando o tx como Db. Como applyTransaction acima já
      // abre sua própria tx, aqui vamos inline pra evitar tx aninhada.
      const outRes = await applyInTx(tx, {
        walletId: input.fromWalletId,
        type: 'transfer_out',
        amountUsd: input.amountUsd,
        reason: input.reason ?? 'transfer_out',
        metadata: { toWalletId: input.toWalletId, ...input.metadata },
        createdBy: input.createdBy,
      })
      const inRes = await applyInTx(tx, {
        walletId: input.toWalletId,
        type: 'transfer_in',
        amountUsd: input.amountUsd,
        reason: input.reason ?? 'transfer_in',
        metadata: { fromWalletId: input.fromWalletId, ...input.metadata },
        createdBy: input.createdBy,
      })
      return {
        fromWallet: outRes.wallet,
        toWallet: inRes.wallet,
        outTransaction: outRes.transaction,
        inTransaction: inRes.transaction,
      }
    })
  }

  async listTransactions(
    walletId: string,
    filter?: ListTransactionsFilter,
  ): Promise<WalletTransaction[]> {
    const conds: SQL[] = [eq(walletTransactions.walletId, walletId)]
    if (filter?.type) conds.push(eq(walletTransactions.type, filter.type))
    if (filter?.since) {
      const { gte } = await import('drizzle-orm')
      conds.push(gte(walletTransactions.createdAt, new Date(filter.since)))
    }

    const base = this.db
      .select()
      .from(walletTransactions)
      .where(and(...conds)!)
      .orderBy(desc(walletTransactions.createdAt))
    const limited = filter?.limit && filter.limit > 0 ? base.limit(filter.limit) : base
    const rows = await limited
    return rows.map(rowToTransaction)
  }

  async updateThresholds(
    walletId: string,
    thresholds: { warning: number; critical: number; danger: number },
  ): Promise<Wallet> {
    const now = new Date()
    await this.db
      .update(wallets)
      .set({
        warningThreshold: thresholds.warning,
        criticalThreshold: thresholds.critical,
        dangerThreshold: thresholds.danger,
        updatedAt: now,
      })
      .where(eq(wallets.id, walletId))
    const found = await this.findById(walletId)
    if (!found) throw new Error(`Wallet not found: ${walletId}`)
    return found
  }
}

/** Versão sem tx-wrap usada pelo transfer() para não aninhar transações. */
async function applyInTx(
  tx: Parameters<Parameters<Db['transaction']>[0]>[0],
  input: ApplyTransactionInput,
): Promise<ApplyTransactionResult> {
  const rows = await tx
    .select()
    .from(wallets)
    .where(eq(wallets.id, input.walletId))
    .for('update')
    .limit(1)
  const row = rows[0]
  if (!row) throw new Error(`Wallet not found: ${input.walletId}`)
  const current = rowToWallet(row)

  const delta = computeSignedDelta(
    input.type,
    input.amountUsd,
    input.signedDelta,
  )
  const newBalance = round4(current.balanceUsd + delta)
  if (newBalance < 0) {
    throw new InsufficientBalanceError(
      current.balanceUsd,
      Math.abs(delta),
    )
  }

  const now = new Date()
  const updated: Wallet = {
    ...current,
    balanceUsd: newBalance,
    totalTopUps:
      delta > 0 && input.type !== 'adjustment'
        ? round4(current.totalTopUps + input.amountUsd)
        : current.totalTopUps,
    totalSpent:
      delta < 0 && input.type !== 'adjustment'
        ? round4(current.totalSpent + input.amountUsd)
        : current.totalSpent,
    version: current.version + 1,
    updatedAt: now.toISOString(),
  }

  await tx
    .update(wallets)
    .set({
      balanceUsd: updated.balanceUsd.toFixed(4),
      totalTopUps: updated.totalTopUps.toFixed(4),
      totalSpent: updated.totalSpent.toFixed(4),
      version: updated.version,
      updatedAt: now,
    })
    .where(eq(wallets.id, input.walletId))

  const txn = validateWalletTransaction({
    id: randomUUID(),
    walletId: input.walletId,
    type: input.type,
    amountUsd: input.amountUsd,
    signedDelta: input.type === 'adjustment' ? delta : undefined,
    reason: input.reason ?? '',
    metadata: input.metadata,
    createdBy: input.createdBy,
    createdAt: now.toISOString(),
  })

  await tx.insert(walletTransactions).values({
    id: txn.id,
    walletId: txn.walletId,
    type: txn.type,
    amountUsd: txn.amountUsd.toFixed(4),
    reason: txn.reason,
    metadata: txn.metadata ?? null,
    createdBy: txn.createdBy ?? null,
    createdAt: now,
  })

  return { wallet: updated, transaction: txn }
}

export function rowToWallet(row: WalletRow): Wallet {
  const thresholds: AlertThresholds = {
    warning: row.warningThreshold,
    critical: row.criticalThreshold,
    danger: row.dangerThreshold,
  }
  return {
    id: row.id,
    ownerId: row.ownerId,
    ownerType: row.ownerType as WalletOwnerType,
    balanceUsd: Number(row.balanceUsd),
    totalTopUps: Number(row.totalTopUps),
    totalSpent: Number(row.totalSpent),
    alertThresholds: thresholds,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function rowToTransaction(row: WalletTransactionRow): WalletTransaction {
  return {
    id: row.id,
    walletId: row.walletId,
    type: row.type as WalletTransaction['type'],
    amountUsd: Number(row.amountUsd),
    reason: row.reason,
    metadata:
      (row.metadata as Record<string, unknown> | null) ?? undefined,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt.toISOString(),
  }
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}
