/**
 * Public API do módulo `wallet`.
 *
 * **Módulo crítico.** Toda operação financeira do produto passa por
 * aqui. Atomicidade de débito+transação é garantida pelos adapters
 * (Postgres: db.transaction()+row lock; InMemory: JS single-thread).
 *
 * Pattern:
 *   import {
 *     PostgresWalletRepository,
 *     topUpWallet,
 *     spendFromWallet,
 *     InsufficientBalanceError,
 *   } from '@/modules/wallet'
 */

// Domain
export type {
  Wallet,
  WalletOwnerType,
  WalletTransaction,
  WalletTransactionType,
  AlertThresholds,
} from './domain/Wallet'
export {
  validateWallet,
  validateWalletTransaction,
  computeSignedDelta,
  isCreditType,
  isDebitType,
  DEFAULT_ALERT_THRESHOLDS,
  WALLET_OWNER_TYPES,
  WALLET_TRANSACTION_TYPES,
  CREDIT_TYPES,
  DEBIT_TYPES,
  InvalidWalletError,
  InvalidWalletTransactionError,
  InsufficientBalanceError,
} from './domain/Wallet'

// Ports
export type {
  WalletRepository,
  CreateWalletInput,
  ApplyTransactionInput,
  ApplyTransactionResult,
  TransferInput,
  TransferResult,
  ListTransactionsFilter,
} from './ports/WalletRepository'

// Infra
export { InMemoryWalletRepository } from './infra/InMemoryWalletRepository'
export {
  PostgresWalletRepository,
  rowToWallet,
  rowToTransaction,
} from './infra/PostgresWalletRepository'
export { RedisWalletRepository } from './infra/RedisWalletRepository'
export { DualWriteWalletRepository } from './infra/DualWriteWalletRepository'

// Composer (M4-PR4) — Redis | DualWrite | Postgres
export { selectWalletRepo } from './composer'

// Use cases
export {
  topUpWallet,
  spendFromWallet,
  refundWallet,
  transferBetweenWallets,
  ensureWallet,
  WalletNotFoundError,
} from './usecases/walletOperations'
