/**
 * RedisWalletRepository — adapter envolvendo o storage legado em
 * `@/lib/wallet.ts` no contrato `WalletRepository`.
 *
 * Existe APENAS durante a migração (M4). Será removido junto com o
 * caminho legado quando `USE_POSTGRES_WALLET` estiver global e estável
 * por 30+ dias.
 *
 * Implementa `applyTransaction` mapeando para `addCredits`/`spendCredits`
 * legados, mantendo a mesma semântica de optimistic lock por `version`.
 */

import { randomUUID } from 'crypto'
import {
  addCredits,
  createWallet as legacyCreateWallet,
  getTransactions as legacyGetTransactions,
  getWallet,
  getWalletByOwner,
  spendCredits,
  transferCredits,
  type Wallet as LegacyWallet,
} from '@/lib/wallet'
import {
  computeSignedDelta,
  validateWalletTransaction,
  InsufficientBalanceError,
  type Wallet,
  type WalletOwnerType,
  type WalletTransaction,
  type WalletTransactionType,
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

function legacyToDomain(w: LegacyWallet): Wallet {
  return {
    id: w.id,
    ownerId: w.ownerId,
    ownerType: w.ownerType,
    balanceUsd: w.balanceUsd,
    totalTopUps: w.totalTopUps,
    totalSpent: w.totalSpent,
    alertThresholds: w.alertThresholds,
    version: w.version,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  }
}

export class RedisWalletRepository implements WalletRepository {
  async findById(id: string): Promise<Wallet | null> {
    const w = await getWallet(id)
    return w ? legacyToDomain(w) : null
  }

  async findByOwner(
    ownerType: WalletOwnerType,
    ownerId: string,
  ): Promise<Wallet | null> {
    const w = await getWalletByOwner(ownerId, ownerType)
    return w ? legacyToDomain(w) : null
  }

  async create(input: CreateWalletInput): Promise<Wallet> {
    const w = await legacyCreateWallet(input.ownerId, input.ownerType)
    return legacyToDomain(w)
  }

  async applyTransaction(
    input: ApplyTransactionInput,
  ): Promise<ApplyTransactionResult> {
    const delta = computeSignedDelta(
      input.type,
      input.amountUsd,
      input.signedDelta,
    )

    // Mapeia metadata genérica para o shape do legado (WalletTransactionMeta)
    // e descarta campos não suportados — o legado é estrito.
    const meta = pickLegacyMeta(input.metadata, input.createdBy)

    let txnId: string | undefined
    let txnCreatedAt: string | undefined
    if (delta > 0) {
      // Crédito: addCredits aceita type ∈ top_up | refund | adjustment | monthly_credit
      const legacyType = mapToCreditType(input.type)
      const t = await addCredits(
        input.walletId,
        Math.abs(delta),
        input.reason ?? '',
        meta,
        legacyType,
      )
      txnId = t.id
      txnCreatedAt = t.createdAt
    } else if (delta < 0) {
      // Débito: spendCredits sempre registra como type='spend'
      try {
        const t = await spendCredits(
          input.walletId,
          Math.abs(delta),
          input.reason ?? '',
          meta,
        )
        txnId = t?.id
        txnCreatedAt = t?.createdAt
      } catch (err) {
        const w = await getWallet(input.walletId)
        if (
          err instanceof Error &&
          /insuficiente|insufficient/i.test(err.message)
        ) {
          throw new InsufficientBalanceError(
            w?.balanceUsd ?? 0,
            Math.abs(delta),
          )
        }
        throw err
      }
    } else {
      throw new Error('applyTransaction com delta=0 não é permitido')
    }

    const wallet = await getWallet(input.walletId)
    if (!wallet) throw new Error(`Wallet not found pós-applyTransaction: ${input.walletId}`)

    const txn = validateWalletTransaction({
      id: txnId ?? randomUUID(),
      walletId: input.walletId,
      type: input.type,
      amountUsd: input.amountUsd,
      signedDelta: input.type === 'adjustment' ? delta : undefined,
      reason: input.reason ?? '',
      metadata: input.metadata,
      createdBy: input.createdBy,
      createdAt: txnCreatedAt ?? new Date().toISOString(),
    })

    return { wallet: legacyToDomain(wallet), transaction: txn }
  }

  async transfer(input: TransferInput): Promise<TransferResult> {
    // O legado transferCredits só aceita 4 args (sem meta/createdBy).
    const pair = await transferCredits(
      input.fromWalletId,
      input.toWalletId,
      input.amountUsd,
      input.reason ?? 'transfer',
    )
    const [from, to] = await Promise.all([
      getWallet(input.fromWalletId),
      getWallet(input.toWalletId),
    ])
    if (!from || !to) {
      throw new Error('Wallet not found pós-transfer')
    }
    const now = new Date().toISOString()
    const out = validateWalletTransaction({
      id: pair?.[0]?.id ?? randomUUID(),
      walletId: input.fromWalletId,
      type: 'transfer_out',
      amountUsd: input.amountUsd,
      reason: input.reason ?? 'transfer_out',
      metadata: { toWalletId: input.toWalletId, ...input.metadata },
      createdBy: input.createdBy,
      createdAt: pair?.[0]?.createdAt ?? now,
    })
    const inn = validateWalletTransaction({
      id: pair?.[1]?.id ?? randomUUID(),
      walletId: input.toWalletId,
      type: 'transfer_in',
      amountUsd: input.amountUsd,
      reason: input.reason ?? 'transfer_in',
      metadata: { fromWalletId: input.fromWalletId, ...input.metadata },
      createdBy: input.createdBy,
      createdAt: pair?.[1]?.createdAt ?? now,
    })
    return {
      fromWallet: legacyToDomain(from),
      toWallet: legacyToDomain(to),
      outTransaction: out,
      inTransaction: inn,
    }
  }

  async listTransactions(
    walletId: string,
    filter?: ListTransactionsFilter,
  ): Promise<WalletTransaction[]> {
    const txns = await legacyGetTransactions(walletId, {
      type: filter?.type,
      limit: filter?.limit,
    })
    return txns.map((t) =>
      validateWalletTransaction({
        id: t.id,
        walletId: t.walletId,
        type: t.type as WalletTransactionType,
        amountUsd: Math.abs(t.amountUsd),
        signedDelta: t.amountUsd,
        reason: t.description ?? '',
        metadata: t.meta as Record<string, unknown> | undefined,
        createdBy: t.meta?.userId,
        createdAt: t.createdAt,
      }),
    )
  }

  async updateThresholds(
    walletId: string,
    _thresholds: { warning: number; critical: number; danger: number },
  ): Promise<Wallet> {
    void walletId
    void _thresholds
    // O legado não expõe API pra mudar thresholds — quem precisar
    // disso na migração faz update direto no Redis. Para evitar
    // divergência silenciosa, lança aqui.
    throw new Error(
      'updateThresholds não suportado pelo RedisWalletRepository legado',
    )
  }
}

/**
 * Converte um record arbitrário em `WalletTransactionMeta` aceitando
 * apenas os campos conhecidos. Campos extras são silenciosamente
 * descartados (sem validação estrita pra não quebrar callers
 * legados que talvez passem campos novos).
 */
function pickLegacyMeta(
  metadata: Record<string, unknown> | undefined,
  createdBy: string | undefined,
): {
  generationType?: string
  engineId?: string
  userId?: string
  fromWalletId?: string
  toWalletId?: string
  paymentRef?: string
  sceneId?: string
  episodeId?: string
} {
  const m = metadata ?? {}
  const out: Record<string, string> = {}
  for (const k of [
    'generationType',
    'engineId',
    'userId',
    'fromWalletId',
    'toWalletId',
    'paymentRef',
    'sceneId',
    'episodeId',
  ]) {
    const v = m[k]
    if (typeof v === 'string') out[k] = v
  }
  if (createdBy && !out.userId) out.userId = createdBy
  return out
}

function mapToCreditType(
  t: WalletTransactionType,
): 'top_up' | 'refund' | 'adjustment' | 'monthly_credit' {
  switch (t) {
    case 'refund':
    case 'adjustment':
    case 'monthly_credit':
      return t
    case 'transfer_in':
    case 'top_up':
    default:
      // O legado registra transfer_in via transferCredits separadamente,
      // então quando chega aqui são chamadas avulsas — mapeamos pra top_up.
      return 'top_up'
  }
}
