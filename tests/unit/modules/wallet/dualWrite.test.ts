import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  DualWriteWalletRepository,
  InMemoryWalletRepository,
  topUpWallet,
  spendFromWallet,
} from '@/modules/wallet'

describe('DualWriteWalletRepository', () => {
  let primary: InMemoryWalletRepository
  let shadow: InMemoryWalletRepository
  let dual: DualWriteWalletRepository

  beforeEach(() => {
    primary = new InMemoryWalletRepository()
    shadow = new InMemoryWalletRepository()
    dual = new DualWriteWalletRepository(primary, shadow)
  })

  it('create cria em primary e em shadow (mesmo id)', async () => {
    const w = await dual.create({ ownerId: 'o', ownerType: 'organization' })
    expect(w.ownerId).toBe('o')
    expect(await primary.findById(w.id)).not.toBeNull()
    // Shadow recebeu com mesmo id
    expect(await shadow.findById(w.id)).not.toBeNull()
  })

  it('reads vêm somente do primary', async () => {
    const w = await primary.create({ ownerId: 'a', ownerType: 'organization' })
    // Shadow está vazio
    expect(await dual.findById(w.id)).not.toBeNull()
    expect(await shadow.findById(w.id)).toBeNull()
  })

  it('applyTransaction propaga para shadow', async () => {
    const w = await dual.create({ ownerId: 'o', ownerType: 'organization' })
    await topUpWallet({ repo: dual }, { walletId: w.id, amountUsd: 10 })

    const fromPrimary = await primary.findById(w.id)
    const fromShadow = await shadow.findById(w.id)
    expect(fromPrimary?.balanceUsd).toBe(10)
    expect(fromShadow?.balanceUsd).toBe(10)
  })

  it('falha do shadow NÃO propaga (write na primary persiste)', async () => {
    // Forçamos shadow.applyTransaction a falhar.
    const failingShadow = new InMemoryWalletRepository()
    const spy = vi
      .spyOn(failingShadow, 'applyTransaction')
      .mockRejectedValue(new Error('shadow caiu'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const dualFail = new DualWriteWalletRepository(primary, failingShadow)
    const w = await primary.create({ ownerId: 'o', ownerType: 'organization' })

    // topUp não deve lançar — primary funciona, shadow falha silenciosamente.
    await topUpWallet({ repo: dualFail }, { walletId: w.id, amountUsd: 5 })
    expect(spy).toHaveBeenCalled()

    // Aguarda microtasks pra reportError ser chamado
    await new Promise((r) => setImmediate(r))

    expect((await primary.findById(w.id))?.balanceUsd).toBe(5)
    errSpy.mockRestore()
    spy.mockRestore()
  })

  it('falha do primary propaga (cliente vê erro)', async () => {
    const failingPrimary = new InMemoryWalletRepository()
    vi.spyOn(failingPrimary, 'applyTransaction').mockRejectedValue(
      new Error('primary caiu'),
    )
    const dualFail = new DualWriteWalletRepository(failingPrimary, shadow)
    const w = await failingPrimary.create({
      ownerId: 'o',
      ownerType: 'organization',
    })

    await expect(
      topUpWallet({ repo: dualFail }, { walletId: w.id, amountUsd: 1 }),
    ).rejects.toThrow(/primary caiu/)
  })

  it('spend insuficiente lança no primary, não toca shadow', async () => {
    const w = await dual.create({ ownerId: 'o', ownerType: 'organization' })
    // Sem saldo
    await expect(
      spendFromWallet(
        { repo: dual },
        { walletId: w.id, amountUsd: 5, reason: 'x' },
      ),
    ).rejects.toThrow()
    // Saldo do shadow permanece 0 (a operação falhou no primary, shadow
    // nem chegou a ser chamado nesse caso).
    const sw = await shadow.findById(w.id)
    expect(sw?.balanceUsd).toBe(0)
  })

  it('transfer atômico: ambos saldos mudam em primary e em shadow', async () => {
    const a = await dual.create({ ownerId: 'a', ownerType: 'organization' })
    const b = await dual.create({ ownerId: 'b', ownerType: 'organization' })
    await topUpWallet({ repo: dual }, { walletId: a.id, amountUsd: 50 })

    await dual.transfer({
      fromWalletId: a.id,
      toWalletId: b.id,
      amountUsd: 30,
      reason: 'split',
    })

    expect((await primary.findById(a.id))?.balanceUsd).toBe(20)
    expect((await primary.findById(b.id))?.balanceUsd).toBe(30)
    expect((await shadow.findById(a.id))?.balanceUsd).toBe(20)
    expect((await shadow.findById(b.id))?.balanceUsd).toBe(30)
  })
})

describe('selectWalletRepo', () => {
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

  it('default (ambas OFF) retorna RedisWalletRepository', async () => {
    const { selectWalletRepo, RedisWalletRepository } = await import(
      '@/modules/wallet'
    )
    expect(selectWalletRepo()).toBeInstanceOf(RedisWalletRepository)
  })

  it('DUAL_WRITE=on retorna DualWrite (Redis primary, Postgres shadow)', async () => {
    process.env.FF_USE_POSTGRES_WALLET_DUAL_WRITE = 'on'
    const { selectWalletRepo, DualWriteWalletRepository } = await import(
      '@/modules/wallet'
    )
    expect(selectWalletRepo()).toBeInstanceOf(DualWriteWalletRepository)
  })

  it('USE_POSTGRES_WALLET=on retorna DualWrite (Postgres primary, Redis shadow)', async () => {
    process.env.FF_USE_POSTGRES_WALLET = 'on'
    const { selectWalletRepo, DualWriteWalletRepository } = await import(
      '@/modules/wallet'
    )
    expect(selectWalletRepo()).toBeInstanceOf(DualWriteWalletRepository)
  })
})
