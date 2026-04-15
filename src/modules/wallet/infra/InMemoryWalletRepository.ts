import { randomUUID } from 'crypto'
import type {
  Wallet,
  WalletTransaction,
  WalletOwnerType,
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

/**
 * Repository in-memory para testes. Simula atomicidade via JS
 * single-thread — em nenhum ponto awaitamos IO durante a operação
 * crítica, então a ordem é determinística. Isso espelha o
 * comportamento do Postgres.
 */
export class InMemoryWalletRepository implements WalletRepository {
  private wallets = new Map<string, Wallet>()
  private ownerIndex = new Map<string, string>() // `type:ownerId` → walletId
  private transactions: WalletTransaction[] = []

  private ownerKey(type: WalletOwnerType, ownerId: string): string {
    return `${type}:${ownerId}`
  }

  async findById(id: string): Promise<Wallet | null> {
    return this.wallets.get(id) ?? null
  }

  async findByOwner(
    ownerType: WalletOwnerType,
    ownerId: string,
  ): Promise<Wallet | null> {
    const id = this.ownerIndex.get(this.ownerKey(ownerType, ownerId))
    if (!id) return null
    return this.wallets.get(id) ?? null
  }

  async create(input: CreateWalletInput): Promise<Wallet> {
    const existing = await this.findByOwner(input.ownerType, input.ownerId)
    if (existing) return existing

    const now = new Date().toISOString()
    const wallet = validateWallet({
      id: input.id ?? randomUUID(),
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      balanceUsd: 0,
      totalTopUps: 0,
      totalSpent: 0,
      alertThresholds: input.alertThresholds ?? DEFAULT_ALERT_THRESHOLDS,
      version: 0,
      createdAt: now,
      updatedAt: now,
    })
    this.wallets.set(wallet.id, wallet)
    this.ownerIndex.set(
      this.ownerKey(wallet.ownerType, wallet.ownerId),
      wallet.id,
    )
    return wallet
  }

  async applyTransaction(
    input: ApplyTransactionInput,
  ): Promise<ApplyTransactionResult> {
    const current = this.wallets.get(input.walletId)
    if (!current) throw new Error(`Wallet not found: ${input.walletId}`)

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

    const now = new Date().toISOString()
    const updated: Wallet = validateWallet({
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
      updatedAt: now,
    })
    this.wallets.set(updated.id, updated)

    const txn: WalletTransaction = validateWalletTransaction({
      id: randomUUID(),
      walletId: input.walletId,
      type: input.type,
      amountUsd: input.amountUsd,
      signedDelta: input.type === 'adjustment' ? delta : undefined,
      reason: input.reason ?? '',
      metadata: input.metadata,
      createdBy: input.createdBy,
      createdAt: now,
    })
    this.transactions.push(txn)

    return { wallet: updated, transaction: txn }
  }

  async transfer(input: TransferInput): Promise<TransferResult> {
    if (input.fromWalletId === input.toWalletId) {
      throw new Error('Cannot transfer to same wallet')
    }
    if (input.amountUsd <= 0) {
      throw new Error('Transfer amount must be positive')
    }
    // Snapshot para rollback
    const snapshotWallets = new Map(this.wallets)
    const snapshotTxnsLen = this.transactions.length
    try {
      const outRes = await this.applyTransaction({
        walletId: input.fromWalletId,
        type: 'transfer_out',
        amountUsd: input.amountUsd,
        reason: input.reason ?? 'transfer_out',
        metadata: { toWalletId: input.toWalletId, ...input.metadata },
        createdBy: input.createdBy,
      })
      const inRes = await this.applyTransaction({
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
    } catch (err) {
      // Rollback
      this.wallets.clear()
      snapshotWallets.forEach((v, k) => this.wallets.set(k, v))
      this.transactions.length = snapshotTxnsLen
      throw err
    }
  }

  async listTransactions(
    walletId: string,
    filter?: ListTransactionsFilter,
  ): Promise<WalletTransaction[]> {
    let items = this.transactions.filter((t) => t.walletId === walletId)
    if (filter?.type) items = items.filter((t) => t.type === filter.type)
    if (filter?.since) items = items.filter((t) => t.createdAt >= filter.since!)
    items = items.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (filter?.limit && filter.limit > 0) items = items.slice(0, filter.limit)
    return items
  }

  async updateThresholds(
    walletId: string,
    thresholds: { warning: number; critical: number; danger: number },
  ): Promise<Wallet> {
    const current = this.wallets.get(walletId)
    if (!current) throw new Error(`Wallet not found: ${walletId}`)
    const updated: Wallet = {
      ...current,
      alertThresholds: thresholds,
      updatedAt: new Date().toISOString(),
    }
    this.wallets.set(walletId, updated)
    return updated
  }

  clear(): void {
    this.wallets.clear()
    this.ownerIndex.clear()
    this.transactions.length = 0
  }
}

/** Arredonda para 4 casas decimais (precisão do schema NUMERIC(14,4)). */
function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}
