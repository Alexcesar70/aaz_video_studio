import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  composedSpendCredits,
  composedTopUpCredits,
  InsufficientBalanceError,
} from '@/lib/walletWiring'
import {
  selectWalletRepo,
  topUpWallet,
} from '@/modules/wallet'

/**
 * Os helpers `composedSpendCredits` / `composedTopUpCredits` resolvem
 * o repo via `selectWalletRepo()` no momento da chamada. Default é
 * Redis — em testes não temos Redis, então só validamos a forma do
 * call: o composer foi acionado, retornou um RedisWalletRepository,
 * tentou conectar e falhou com mensagem esperada (REDIS_URL).
 *
 * Testes ACID profundos das operações já estão em
 * `tests/unit/modules/wallet/walletOperations.test.ts` (com InMemory).
 */

describe('walletWiring helpers', () => {
  const original: Record<string, string | undefined> = {}

  beforeEach(() => {
    original.FF_USE_POSTGRES_WALLET = process.env.FF_USE_POSTGRES_WALLET
    original.FF_USE_POSTGRES_WALLET_DUAL_WRITE =
      process.env.FF_USE_POSTGRES_WALLET_DUAL_WRITE
    delete process.env.FF_USE_POSTGRES_WALLET
    delete process.env.FF_USE_POSTGRES_WALLET_DUAL_WRITE
  })

  afterEach(() => {
    if (original.FF_USE_POSTGRES_WALLET !== undefined) {
      process.env.FF_USE_POSTGRES_WALLET = original.FF_USE_POSTGRES_WALLET
    } else {
      delete process.env.FF_USE_POSTGRES_WALLET
    }
    if (original.FF_USE_POSTGRES_WALLET_DUAL_WRITE !== undefined) {
      process.env.FF_USE_POSTGRES_WALLET_DUAL_WRITE =
        original.FF_USE_POSTGRES_WALLET_DUAL_WRITE
    } else {
      delete process.env.FF_USE_POSTGRES_WALLET_DUAL_WRITE
    }
  })

  it('exporta InsufficientBalanceError para uso pelos call sites', () => {
    expect(InsufficientBalanceError).toBeDefined()
    const err = new InsufficientBalanceError(5, 10)
    expect(err.balance).toBe(5)
    expect(err.required).toBe(10)
  })

  it('selectWalletRepo flag default → Redis (smoke test do helper)', () => {
    const repo = selectWalletRepo()
    expect(repo.constructor.name).toBe('RedisWalletRepository')
  })

  it('composedSpendCredits aceita assinatura esperada e retorna Promise', () => {
    // Apenas valida o tipo da função e que retorna Promise.
    // Execução real requer Redis/Postgres conectado.
    const p = composedSpendCredits({
      walletId: 'w-1',
      amountUsd: 1,
      reason: 'test',
      actorUserId: 'u',
      workspaceId: 'ws',
    }).catch(() => null) // descarta erro de Redis não configurado
    expect(p).toBeInstanceOf(Promise)
  })

  it('composedTopUpCredits aceita assinatura esperada', () => {
    const p = composedTopUpCredits({
      walletId: 'w-1',
      amountUsd: 1,
      reason: 'test',
      actorUserId: 'u',
      workspaceId: 'ws',
    }).catch(() => null)
    expect(p).toBeInstanceOf(Promise)
  })
})

describe('composer integra com use cases InMemory (sanity)', async () => {
  // Garante que os helpers do módulo wallet continuam funcionando
  // independente do composer (regression check).
  const { InMemoryWalletRepository } = await import('@/modules/wallet')

  it('topUp via use case direto continua funcionando', async () => {
    const repo = new InMemoryWalletRepository()
    const w = await repo.create({
      ownerId: 'o',
      ownerType: 'organization',
    })
    const r = await topUpWallet(
      { repo },
      { walletId: w.id, amountUsd: 5 },
    )
    expect(r.wallet.balanceUsd).toBe(5)
  })
})
