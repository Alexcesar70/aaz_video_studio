/**
 * Wallet model — sistema de créditos/saldo para organizações e usuários.
 *
 * Cada organização (ou usuário individual) tem uma wallet que rastreia
 * saldo, top-ups, gastos e transferências. Todas as operações financeiras
 * passam pelo wallet, garantindo rastreabilidade completa.
 *
 * Redis keys:
 *  - aaz:wallet:{id}                          → Wallet JSON
 *  - aaz:wallet_txn:{walletId}                → Sorted set de transações (score = epoch ms)
 *  - aaz:wallet_owner:{ownerType}:{ownerId}   → walletId (índice secundário)
 *
 * Atomicidade:
 *  Operações que modificam saldo usam read-modify-write com campo `version`
 *  para otimistic locking. Se a versão mudar entre o read e o write, a
 *  operação é rejeitada e deve ser retentada pelo caller.
 */

import { getRedis } from './redis'

// ── Types ────────────────────────────────────────────────────────

export interface Wallet {
  /** Identificador único da wallet */
  id: string
  /** ID do dono (orgId ou userId) */
  ownerId: string
  /** Tipo do dono */
  ownerType: 'organization' | 'user'
  /** Saldo atual em USD */
  balanceUsd: number
  /** Total acumulado de créditos adicionados (lifetime) */
  totalTopUps: number
  /** Total acumulado de créditos gastos (lifetime) */
  totalSpent: number
  /** Limiares de alerta em porcentagem do saldo vs gasto */
  alertThresholds: {
    /** Porcentagem de saldo restante que dispara warning (default 20%) */
    warning: number
    /** Porcentagem de saldo restante que dispara critical (default 10%) */
    critical: number
    /** Porcentagem de saldo restante que dispara danger (default 5%) */
    danger: number
  }
  /** Versão para optimistic locking */
  version: number
  /** Data de criação ISO */
  createdAt: string
  /** Data da última atualização ISO */
  updatedAt: string
}

export type WalletTransactionType =
  | 'top_up'
  | 'spend'
  | 'transfer_in'
  | 'transfer_out'
  | 'refund'
  | 'adjustment'
  | 'monthly_credit'

export interface WalletTransactionMeta {
  /** Tipo de geração (video, image, scene_director, image_director) */
  generationType?: string
  /** ID da engine utilizada */
  engineId?: string
  /** ID do usuário que iniciou a operação */
  userId?: string
  /** Wallet de origem (em transferências) */
  fromWalletId?: string
  /** Wallet de destino (em transferências) */
  toWalletId?: string
  /** Referência de pagamento externo (Stripe, Hotmart, etc.) */
  paymentRef?: string
  /** ID da cena (quando aplicável) */
  sceneId?: string
  /** ID do episódio (quando aplicável) */
  episodeId?: string
}

export interface WalletTransaction {
  /** Identificador único da transação */
  id: string
  /** ID da wallet associada */
  walletId: string
  /** Tipo da transação */
  type: WalletTransactionType
  /** Valor em USD (positivo para adições, negativo para deduções) */
  amountUsd: number
  /** Saldo da wallet após esta transação */
  balanceAfter: number
  /** Descrição legível da transação */
  description: string
  /** Metadados contextuais */
  meta: WalletTransactionMeta
  /** Data da transação ISO */
  createdAt: string
}

export type AlertLevel = 'ok' | 'warning' | 'critical' | 'danger' | 'empty'

export interface BalanceCheckResult {
  /** Se a operação é permitida (saldo suficiente) */
  allowed: boolean
  /** Saldo atual */
  balance: number
  /** Nível de alerta baseado nos thresholds */
  alertLevel: AlertLevel
}

// ── Constants ────────────────────────────────────────────────────

const WALLET_PREFIX = 'aaz:wallet:'
const TXN_PREFIX = 'aaz:wallet_txn:'
const OWNER_INDEX_PREFIX = 'aaz:wallet_owner:'

const MAX_TRANSACTIONS_PER_WALLET = 50_000

// ── Helpers ──────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Calcula o nível de alerta baseado no saldo atual vs total investido.
 * Se nunca houve top-up, retorna 'ok' (wallet nova/vazia).
 */
function computeAlertLevel(wallet: Wallet): AlertLevel {
  if (wallet.totalTopUps === 0) return 'ok'
  if (wallet.balanceUsd <= 0) return 'empty'

  const remainingPct = (wallet.balanceUsd / wallet.totalTopUps) * 100

  if (remainingPct <= wallet.alertThresholds.danger) return 'danger'
  if (remainingPct <= wallet.alertThresholds.critical) return 'critical'
  if (remainingPct <= wallet.alertThresholds.warning) return 'warning'
  return 'ok'
}

// ── CRUD ─────────────────────────────────────────────────────────

/**
 * Cria uma nova wallet com saldo zero.
 * Se já existir uma wallet para o mesmo owner, retorna a existente.
 */
export async function createWallet(
  ownerId: string,
  ownerType: 'organization' | 'user'
): Promise<Wallet> {
  const redis = await getRedis()

  // Verifica se já existe
  const existingId = await redis.get(`${OWNER_INDEX_PREFIX}${ownerType}:${ownerId}`)
  if (existingId) {
    const existing = await getWallet(existingId)
    if (existing) return existing
  }

  const now = new Date().toISOString()
  const id = `wal_${generateId()}`

  const wallet: Wallet = {
    id,
    ownerId,
    ownerType,
    balanceUsd: 0,
    totalTopUps: 0,
    totalSpent: 0,
    alertThresholds: {
      warning: 20,
      critical: 10,
      danger: 5,
    },
    version: 1,
    createdAt: now,
    updatedAt: now,
  }

  await redis.set(`${WALLET_PREFIX}${id}`, JSON.stringify(wallet))
  await redis.set(`${OWNER_INDEX_PREFIX}${ownerType}:${ownerId}`, id)

  return wallet
}

/**
 * Retorna uma wallet pelo id, ou null se não existir.
 */
export async function getWallet(walletId: string): Promise<Wallet | null> {
  const redis = await getRedis()
  const val = await redis.get(`${WALLET_PREFIX}${walletId}`)
  if (!val) return null
  try {
    return JSON.parse(val) as Wallet
  } catch {
    return null
  }
}

/**
 * Retorna a wallet pelo dono (orgId ou userId).
 */
export async function getWalletByOwner(
  ownerId: string,
  ownerType: 'organization' | 'user'
): Promise<Wallet | null> {
  const redis = await getRedis()
  const walletId = await redis.get(`${OWNER_INDEX_PREFIX}${ownerType}:${ownerId}`)
  if (!walletId) return null
  return getWallet(walletId)
}

/**
 * Retorna o saldo atual da wallet.
 * @throws Se a wallet não existir.
 */
export async function getBalance(walletId: string): Promise<number> {
  const wallet = await getWallet(walletId)
  if (!wallet) throw new Error(`Wallet "${walletId}" não encontrada.`)
  return wallet.balanceUsd
}

/**
 * Verifica se a wallet tem saldo suficiente para uma operação.
 * Retorna o resultado com nível de alerta.
 */
export async function checkBalance(
  walletId: string,
  requiredAmount: number
): Promise<BalanceCheckResult> {
  const wallet = await getWallet(walletId)
  if (!wallet) {
    return { allowed: false, balance: 0, alertLevel: 'empty' }
  }

  const allowed = wallet.balanceUsd >= requiredAmount
  const alertLevel = computeAlertLevel(wallet)

  return { allowed, balance: wallet.balanceUsd, alertLevel }
}

// ── Transações ───────────────────────────────────────────────────

/**
 * Salva a wallet com optimistic locking (verifica que a versão não mudou).
 * @throws Se a versão mudou (concorrência detectada).
 */
async function saveWalletWithLock(
  wallet: Wallet,
  expectedVersion: number
): Promise<Wallet> {
  const redis = await getRedis()

  // Re-read para verificar versão
  const current = await getWallet(wallet.id)
  if (!current) throw new Error(`Wallet "${wallet.id}" não encontrada.`)
  if (current.version !== expectedVersion) {
    throw new Error(
      `Conflito de concorrência na wallet "${wallet.id}": ` +
      `esperava versão ${expectedVersion}, encontrou ${current.version}. Tente novamente.`
    )
  }

  const updated: Wallet = {
    ...wallet,
    version: expectedVersion + 1,
    updatedAt: new Date().toISOString(),
  }

  await redis.set(`${WALLET_PREFIX}${wallet.id}`, JSON.stringify(updated))
  return updated
}

/**
 * Registra uma transação no sorted set da wallet.
 */
async function recordTransaction(txn: WalletTransaction): Promise<void> {
  const redis = await getRedis()
  const key = `${TXN_PREFIX}${txn.walletId}`
  const score = new Date(txn.createdAt).getTime()

  await redis.zAdd(key, { score, value: JSON.stringify(txn) })

  // Prune — mantém últimas MAX_TRANSACTIONS_PER_WALLET
  const size = await redis.zCard(key)
  if (size > MAX_TRANSACTIONS_PER_WALLET) {
    await redis.zRemRangeByRank(key, 0, size - MAX_TRANSACTIONS_PER_WALLET - 1)
  }
}

/**
 * Adiciona créditos à wallet (top-up, monthly credit, refund, adjustment).
 * @returns A transação criada.
 */
export async function addCredits(
  walletId: string,
  amount: number,
  description: string,
  meta: WalletTransactionMeta = {},
  type: Extract<WalletTransactionType, 'top_up' | 'refund' | 'adjustment' | 'monthly_credit'> = 'top_up'
): Promise<WalletTransaction> {
  if (amount <= 0) throw new Error('Valor deve ser positivo para addCredits.')

  const wallet = await getWallet(walletId)
  if (!wallet) throw new Error(`Wallet "${walletId}" não encontrada.`)

  const expectedVersion = wallet.version
  const newBalance = wallet.balanceUsd + amount

  wallet.balanceUsd = newBalance
  if (type === 'top_up' || type === 'monthly_credit') {
    wallet.totalTopUps += amount
  }

  await saveWalletWithLock(wallet, expectedVersion)

  const txn: WalletTransaction = {
    id: `txn_${generateId()}`,
    walletId,
    type,
    amountUsd: amount,
    balanceAfter: newBalance,
    description,
    meta,
    createdAt: new Date().toISOString(),
  }

  await recordTransaction(txn)
  return txn
}

/**
 * Gasta créditos da wallet.
 * Rejeita se o saldo ficaria negativo.
 *
 * @returns A transação criada, ou null se saldo insuficiente.
 */
export async function spendCredits(
  walletId: string,
  amount: number,
  description: string,
  meta: WalletTransactionMeta = {}
): Promise<WalletTransaction | null> {
  if (amount <= 0) throw new Error('Valor deve ser positivo para spendCredits.')

  const wallet = await getWallet(walletId)
  if (!wallet) throw new Error(`Wallet "${walletId}" não encontrada.`)

  // Hard reject se saldo insuficiente
  if (wallet.balanceUsd < amount) {
    return null
  }

  const expectedVersion = wallet.version
  const newBalance = wallet.balanceUsd - amount

  wallet.balanceUsd = newBalance
  wallet.totalSpent += amount

  await saveWalletWithLock(wallet, expectedVersion)

  const txn: WalletTransaction = {
    id: `txn_${generateId()}`,
    walletId,
    type: 'spend',
    amountUsd: -amount, // negativo para deduções
    balanceAfter: newBalance,
    description,
    meta,
    createdAt: new Date().toISOString(),
  }

  await recordTransaction(txn)
  return txn
}

/**
 * Transfere créditos de uma wallet para outra.
 * Cria duas transações: transfer_out na origem, transfer_in no destino.
 *
 * @returns As duas transações criadas [out, in], ou null se saldo insuficiente.
 */
export async function transferCredits(
  fromWalletId: string,
  toWalletId: string,
  amount: number,
  description: string
): Promise<[WalletTransaction, WalletTransaction] | null> {
  if (amount <= 0) throw new Error('Valor deve ser positivo para transferCredits.')
  if (fromWalletId === toWalletId) throw new Error('Não é possível transferir para a mesma wallet.')

  const fromWallet = await getWallet(fromWalletId)
  if (!fromWallet) throw new Error(`Wallet de origem "${fromWalletId}" não encontrada.`)

  const toWallet = await getWallet(toWalletId)
  if (!toWallet) throw new Error(`Wallet de destino "${toWalletId}" não encontrada.`)

  // Check saldo na origem
  if (fromWallet.balanceUsd < amount) {
    return null
  }

  const now = new Date().toISOString()

  // Debitar da origem
  const fromVersion = fromWallet.version
  fromWallet.balanceUsd -= amount
  fromWallet.totalSpent += amount
  await saveWalletWithLock(fromWallet, fromVersion)

  // Creditar no destino
  const toVersion = toWallet.version
  toWallet.balanceUsd += amount
  toWallet.totalTopUps += amount
  await saveWalletWithLock(toWallet, toVersion)

  const txnOut: WalletTransaction = {
    id: `txn_${generateId()}`,
    walletId: fromWalletId,
    type: 'transfer_out',
    amountUsd: -amount,
    balanceAfter: fromWallet.balanceUsd,
    description,
    meta: { toWalletId },
    createdAt: now,
  }

  const txnIn: WalletTransaction = {
    id: `txn_${generateId()}`,
    walletId: toWalletId,
    type: 'transfer_in',
    amountUsd: amount,
    balanceAfter: toWallet.balanceUsd,
    description,
    meta: { fromWalletId },
    createdAt: now,
  }

  await recordTransaction(txnOut)
  await recordTransaction(txnIn)

  return [txnOut, txnIn]
}

/**
 * Consulta transações de uma wallet com filtros opcionais.
 * Retorna em ordem cronológica reversa (mais recente primeiro).
 */
/**
 * Verifica se a wallet da organização do usuário tem saldo suficiente.
 * Usuários legados (sem organizationId) são liberados automaticamente (skip).
 *
 * @returns { allowed, walletId, balance, reason? }
 */
export async function checkWalletBalance(
  userId: string,
  organizationId: string | undefined,
  estimatedCost: number
): Promise<{ allowed: boolean; walletId: string | null; balance: number; reason?: string }> {
  // Legacy users without org — skip wallet check entirely
  if (!organizationId) {
    return { allowed: true, walletId: null, balance: 0 }
  }

  const wallet = await getWalletByOwner(organizationId, 'organization')
  if (!wallet) {
    // Org exists but no wallet yet — allow (bootstrap edge case)
    return { allowed: true, walletId: null, balance: 0 }
  }

  if (wallet.balanceUsd < estimatedCost) {
    return {
      allowed: false,
      walletId: wallet.id,
      balance: wallet.balanceUsd,
      reason: `Saldo insuficiente na wallet da organização. Saldo: $${wallet.balanceUsd.toFixed(2)}, custo estimado: $${estimatedCost.toFixed(4)}. Peça ao admin para adicionar créditos.`,
    }
  }

  return {
    allowed: true,
    walletId: wallet.id,
    balance: wallet.balanceUsd,
  }
}

export async function getTransactions(
  walletId: string,
  options: {
    /** Epoch ms início do intervalo */
    from?: number
    /** Epoch ms fim do intervalo */
    to?: number
    /** Máximo de transações retornadas (default 100) */
    limit?: number
    /** Filtrar por tipo de transação */
    type?: WalletTransactionType
  } = {}
): Promise<WalletTransaction[]> {
  const redis = await getRedis()
  const key = `${TXN_PREFIX}${walletId}`
  const min = options.from ?? '-inf'
  const max = options.to ?? '+inf'
  const limit = options.limit ?? 100

  // Fetch do intervalo (ascendente por score/timestamp)
  const raw = await redis.zRangeByScore(key, min, max, {
    LIMIT: { offset: 0, count: limit * 2 },
  })

  const parsed: WalletTransaction[] = []
  for (const r of raw) {
    try {
      const txn = JSON.parse(r) as WalletTransaction
      if (!options.type || txn.type === options.type) {
        parsed.push(txn)
      }
    } catch { /* skip malformed */ }
  }

  // Reverse para newest-first
  parsed.reverse()

  return parsed.slice(0, limit)
}
