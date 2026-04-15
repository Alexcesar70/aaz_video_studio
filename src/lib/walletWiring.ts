/**
 * Wrappers que resolvem o `WalletRepository` via composer e executam
 * operações comuns (spend, top-up). Usado em pontos de geração que
 * precisam debitar mas não querem instanciar `selectWalletRepo()`
 * direto inline.
 *
 * Mantém compatibilidade de assinatura com `@/lib/wallet`
 * (`spendCredits` legado) — o caller só precisa trocar o import.
 *
 * Por que esta camada existe: usecases de geração (`generateVideo`)
 * são invocados em múltiplos surfaces (rota síncrona + Inngest
 * function). Se cada um chamasse `selectWalletRepo()` com seu
 * próprio FeatureFlagContext, podia divergir. Centralizar aqui
 * garante semântica única.
 */

import {
  selectWalletRepo,
  spendFromWallet,
  topUpWallet,
  type WalletTransaction,
  type Wallet,
  InsufficientBalanceError,
} from '@/modules/wallet'

export interface ComposedSpendInput {
  walletId: string
  amountUsd: number
  reason: string
  /** Metadata legada aceita: generationType, engineId, userId, sceneId... */
  metadata?: Record<string, unknown>
  /** Para resolver flag user-targeted. */
  actorUserId?: string
  /** Para resolver flag workspace-targeted. */
  workspaceId?: string | null
}

export interface ComposedSpendResult {
  wallet: Wallet
  transaction: WalletTransaction
}

export async function composedSpendCredits(
  input: ComposedSpendInput,
): Promise<ComposedSpendResult> {
  const repo = selectWalletRepo({
    userId: input.actorUserId,
    workspaceId: input.workspaceId ?? undefined,
  })
  return spendFromWallet(
    { repo },
    {
      walletId: input.walletId,
      amountUsd: input.amountUsd,
      reason: input.reason,
      metadata: input.metadata,
      createdBy: input.actorUserId,
    },
  )
}

export async function composedTopUpCredits(
  input: ComposedSpendInput,
): Promise<ComposedSpendResult> {
  const repo = selectWalletRepo({
    userId: input.actorUserId,
    workspaceId: input.workspaceId ?? undefined,
  })
  return topUpWallet(
    { repo },
    {
      walletId: input.walletId,
      amountUsd: input.amountUsd,
      reason: input.reason,
      metadata: input.metadata,
      createdBy: input.actorUserId,
    },
  )
}

// Re-export para conveniência dos call sites
export { InsufficientBalanceError }
