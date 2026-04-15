import type {
  Wallet,
  WalletOwnerType,
  WalletTransaction,
  WalletTransactionType,
} from '../domain/Wallet'

/**
 * Contrato de persistência de Wallet + Transactions.
 *
 * **Atomicidade é contratual.** `applyTransaction` DEVE:
 *   1. Ler o saldo atual.
 *   2. Validar que o delta não leva a saldo negativo.
 *   3. Atualizar o saldo + registrar a transação NO MESMO COMMIT.
 *   4. Retornar wallet atualizada + a transação registrada.
 *
 * Implementações:
 *   - PostgresWalletRepository: usa `db.transaction()` (BEGIN/COMMIT).
 *     CHECK constraint em `balance_usd >= 0` é o safety net final.
 *   - InMemoryWalletRepository: JS single-thread, mas simula a
 *     ordem de operações que produziria o mesmo resultado em SQL.
 */
export interface CreateWalletInput {
  id?: string
  ownerId: string
  ownerType: WalletOwnerType
  alertThresholds?: {
    warning: number
    critical: number
    danger: number
  }
}

export interface ApplyTransactionInput {
  walletId: string
  type: WalletTransactionType
  /** Sempre positivo (exceto para `adjustment`, que pode ignorar e usar signedDelta). */
  amountUsd: number
  /** Obrigatório quando type='adjustment'. Para outros, derivado do type. */
  signedDelta?: number
  reason?: string
  metadata?: Record<string, unknown>
  createdBy?: string
  /** Opcional — se fornecido, a operação rejeita se version mudou (optimistic lock). */
  expectedVersion?: number
}

export interface ApplyTransactionResult {
  wallet: Wallet
  transaction: WalletTransaction
}

export interface TransferInput {
  fromWalletId: string
  toWalletId: string
  amountUsd: number
  reason?: string
  metadata?: Record<string, unknown>
  createdBy?: string
}

export interface TransferResult {
  fromWallet: Wallet
  toWallet: Wallet
  outTransaction: WalletTransaction
  inTransaction: WalletTransaction
}

export interface ListTransactionsFilter {
  type?: WalletTransactionType
  since?: string
  limit?: number
}

export interface WalletRepository {
  findById(id: string): Promise<Wallet | null>
  findByOwner(
    ownerType: WalletOwnerType,
    ownerId: string,
  ): Promise<Wallet | null>

  create(input: CreateWalletInput): Promise<Wallet>

  /**
   * Operação atômica de débito/crédito. Lança
   * `InsufficientBalanceError` se resultaria em saldo < 0 para um débito.
   */
  applyTransaction(input: ApplyTransactionInput): Promise<ApplyTransactionResult>

  /**
   * Transfere atomicamente entre duas wallets. Se qualquer uma das
   * duas operações falhar, TUDO é revertido.
   */
  transfer(input: TransferInput): Promise<TransferResult>

  listTransactions(
    walletId: string,
    filter?: ListTransactionsFilter,
  ): Promise<WalletTransaction[]>

  /** Atualiza metadata (thresholds). NUNCA muda balance/version diretamente. */
  updateThresholds(
    walletId: string,
    thresholds: { warning: number; critical: number; danger: number },
  ): Promise<Wallet>
}
