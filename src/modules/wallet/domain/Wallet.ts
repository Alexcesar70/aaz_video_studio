/**
 * Wallet + WalletTransaction — entidades de domínio.
 *
 * **Ponto crítico do sistema.** Toda operação financeira do produto
 * passa por aqui: top-up manual, débito por geração de vídeo/imagem/
 * música, transferências entre workspaces, refunds.
 *
 * O módulo é PURO — mas representa o shape exato persistido. A
 * atomicidade (debit + insert transação num único commit SQL) é
 * responsabilidade do adapter. Ver `PostgresWalletRepository`.
 *
 * Regras invariantes:
 *   - `balanceUsd >= 0` sempre (garantido por CHECK no Postgres).
 *   - `version` é monotônico crescente — optimistic lock.
 *   - Transactions são APPEND-ONLY. Nunca editar uma txn existente.
 *   - `amountUsd` em transactions é SEMPRE positivo; `type`
 *     determina direção (credit/debit).
 */

export type WalletOwnerType = 'organization' | 'user'
export const WALLET_OWNER_TYPES: readonly WalletOwnerType[] = [
  'organization',
  'user',
] as const

export interface AlertThresholds {
  /** % do saldo restante que dispara WARN (default 20). */
  warning: number
  /** % que dispara CRITICAL (default 10). */
  critical: number
  /** % que dispara DANGER (default 5). */
  danger: number
}

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  warning: 20,
  critical: 10,
  danger: 5,
}

export interface Wallet {
  id: string
  ownerId: string
  ownerType: WalletOwnerType
  balanceUsd: number
  totalTopUps: number
  totalSpent: number
  alertThresholds: AlertThresholds
  version: number
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

export type WalletTransactionType =
  | 'top_up'
  | 'spend'
  | 'transfer_in'
  | 'transfer_out'
  | 'refund'
  | 'adjustment'
  | 'monthly_credit'

export const WALLET_TRANSACTION_TYPES: readonly WalletTransactionType[] = [
  'top_up',
  'spend',
  'transfer_in',
  'transfer_out',
  'refund',
  'adjustment',
  'monthly_credit',
] as const

/** Types que aumentam o saldo. */
export const CREDIT_TYPES: readonly WalletTransactionType[] = [
  'top_up',
  'transfer_in',
  'refund',
  'monthly_credit',
] as const

/** Types que reduzem o saldo. */
export const DEBIT_TYPES: readonly WalletTransactionType[] = [
  'spend',
  'transfer_out',
] as const

/** Ajuste pode ser positivo ou negativo — é caso especial. */

export function isCreditType(type: WalletTransactionType): boolean {
  return (CREDIT_TYPES as readonly WalletTransactionType[]).includes(type)
}

export function isDebitType(type: WalletTransactionType): boolean {
  return (DEBIT_TYPES as readonly WalletTransactionType[]).includes(type)
}

export interface WalletTransaction {
  id: string
  walletId: string
  type: WalletTransactionType
  /** SEMPRE positivo. Direção vem do `type`. Para `adjustment`, usa `signedDelta`. */
  amountUsd: number
  /** Apenas para `adjustment`: pode ser +/-. Para outros, sempre derivado do type. */
  signedDelta?: number
  reason: string
  metadata?: Record<string, unknown>
  createdBy?: string
  createdAt: string // ISO 8601
}

export class InvalidWalletError extends Error {
  constructor(message: string) {
    super(`Invalid Wallet: ${message}`)
    this.name = 'InvalidWalletError'
  }
}

export class InvalidWalletTransactionError extends Error {
  constructor(message: string) {
    super(`Invalid WalletTransaction: ${message}`)
    this.name = 'InvalidWalletTransactionError'
  }
}

export class InsufficientBalanceError extends Error {
  public readonly balance: number
  public readonly required: number
  constructor(balance: number, required: number) {
    super(
      `Insufficient balance: have ${balance.toFixed(4)}, need ${required.toFixed(4)}`,
    )
    this.name = 'InsufficientBalanceError'
    this.balance = balance
    this.required = required
  }
}

const ID_REGEX = /^[A-Za-z0-9_-]+$/

export function validateWallet(input: Partial<Wallet>): Wallet {
  if (!input.id || typeof input.id !== 'string') {
    throw new InvalidWalletError('id é obrigatório')
  }
  if (!ID_REGEX.test(input.id)) {
    throw new InvalidWalletError(`id inválido "${input.id}"`)
  }
  if (typeof input.ownerId !== 'string' || input.ownerId.length === 0) {
    throw new InvalidWalletError('ownerId é obrigatório')
  }
  if (!input.ownerType || !WALLET_OWNER_TYPES.includes(input.ownerType)) {
    throw new InvalidWalletError(
      `ownerType inválido: ${String(input.ownerType)}`,
    )
  }
  if (typeof input.balanceUsd !== 'number' || input.balanceUsd < 0) {
    throw new InvalidWalletError('balanceUsd deve ser número >= 0')
  }
  if (typeof input.totalTopUps !== 'number' || input.totalTopUps < 0) {
    throw new InvalidWalletError('totalTopUps deve ser número >= 0')
  }
  if (typeof input.totalSpent !== 'number' || input.totalSpent < 0) {
    throw new InvalidWalletError('totalSpent deve ser número >= 0')
  }
  if (typeof input.version !== 'number' || input.version < 0) {
    throw new InvalidWalletError('version deve ser número >= 0')
  }

  const now = new Date().toISOString()
  return {
    id: input.id,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
    balanceUsd: input.balanceUsd,
    totalTopUps: input.totalTopUps,
    totalSpent: input.totalSpent,
    alertThresholds: input.alertThresholds ?? DEFAULT_ALERT_THRESHOLDS,
    version: input.version,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  }
}

export function validateWalletTransaction(
  input: Partial<WalletTransaction>,
): WalletTransaction {
  if (!input.id || typeof input.id !== 'string') {
    throw new InvalidWalletTransactionError('id é obrigatório')
  }
  if (typeof input.walletId !== 'string' || input.walletId.length === 0) {
    throw new InvalidWalletTransactionError('walletId é obrigatório')
  }
  if (!input.type || !WALLET_TRANSACTION_TYPES.includes(input.type)) {
    throw new InvalidWalletTransactionError(
      `type inválido: ${String(input.type)}`,
    )
  }
  if (typeof input.amountUsd !== 'number' || input.amountUsd < 0) {
    throw new InvalidWalletTransactionError(
      'amountUsd deve ser número >= 0 (direção vem do type)',
    )
  }
  if (
    input.signedDelta !== undefined &&
    typeof input.signedDelta !== 'number'
  ) {
    throw new InvalidWalletTransactionError('signedDelta deve ser número')
  }
  return {
    id: input.id,
    walletId: input.walletId,
    type: input.type,
    amountUsd: input.amountUsd,
    signedDelta: input.signedDelta,
    reason: input.reason ?? '',
    metadata: input.metadata,
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? new Date().toISOString(),
  }
}

/**
 * Calcula o delta com sinal a partir do type e amountUsd.
 * Para `adjustment`, o caller DEVE fornecer signedDelta explicitamente.
 */
export function computeSignedDelta(
  type: WalletTransactionType,
  amountUsd: number,
  signedDelta?: number,
): number {
  if (type === 'adjustment') {
    if (signedDelta === undefined) {
      throw new InvalidWalletTransactionError(
        'adjustment requer signedDelta explícito',
      )
    }
    return signedDelta
  }
  return isCreditType(type) ? +amountUsd : -amountUsd
}
