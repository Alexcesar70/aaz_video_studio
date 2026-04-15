import type {
  Wallet,
  WalletTransaction,
  WalletOwnerType,
} from '../domain/Wallet'
import type {
  WalletRepository,
  TransferResult,
} from '../ports/WalletRepository'

export class WalletNotFoundError extends Error {
  constructor(key: string) {
    super(`Wallet not found: ${key}`)
    this.name = 'WalletNotFoundError'
  }
}

/**
 * Adiciona saldo (top-up manual, admin faz isso). Registra txn.
 */
export async function topUpWallet(
  deps: { repo: WalletRepository },
  input: {
    walletId: string
    amountUsd: number
    reason?: string
    createdBy?: string
    metadata?: Record<string, unknown>
  },
): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
  if (input.amountUsd <= 0) {
    throw new Error('top-up amount must be positive')
  }
  return deps.repo.applyTransaction({
    walletId: input.walletId,
    type: 'top_up',
    amountUsd: input.amountUsd,
    reason: input.reason ?? 'manual top-up',
    metadata: input.metadata,
    createdBy: input.createdBy,
  })
}

/**
 * Debita do saldo (gerações). Lança InsufficientBalanceError se não
 * houver saldo.
 */
export async function spendFromWallet(
  deps: { repo: WalletRepository },
  input: {
    walletId: string
    amountUsd: number
    reason: string
    metadata?: Record<string, unknown>
    createdBy?: string
  },
): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
  if (input.amountUsd <= 0) {
    throw new Error('spend amount must be positive')
  }
  return deps.repo.applyTransaction({
    walletId: input.walletId,
    type: 'spend',
    amountUsd: input.amountUsd,
    reason: input.reason,
    metadata: input.metadata,
    createdBy: input.createdBy,
  })
}

/**
 * Estorna (credita de volta). Pareado tipicamente com uma txn de
 * `spend` anterior — metadata deve conter o id da spend original.
 */
export async function refundWallet(
  deps: { repo: WalletRepository },
  input: {
    walletId: string
    amountUsd: number
    reason: string
    metadata?: Record<string, unknown>
    createdBy?: string
  },
): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
  if (input.amountUsd <= 0) {
    throw new Error('refund amount must be positive')
  }
  return deps.repo.applyTransaction({
    walletId: input.walletId,
    type: 'refund',
    amountUsd: input.amountUsd,
    reason: input.reason,
    metadata: input.metadata,
    createdBy: input.createdBy,
  })
}

export async function transferBetweenWallets(
  deps: { repo: WalletRepository },
  input: {
    fromWalletId: string
    toWalletId: string
    amountUsd: number
    reason?: string
    createdBy?: string
  },
): Promise<TransferResult> {
  return deps.repo.transfer(input)
}

/**
 * Garante que uma wallet existe para o owner. Idempotente — cria
 * se não existir, retorna a atual caso contrário.
 */
export async function ensureWallet(
  deps: { repo: WalletRepository },
  input: { ownerId: string; ownerType: WalletOwnerType },
): Promise<Wallet> {
  const existing = await deps.repo.findByOwner(input.ownerType, input.ownerId)
  if (existing) return existing
  return deps.repo.create(input)
}
