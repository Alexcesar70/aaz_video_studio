import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryWalletRepository,
  topUpWallet,
  spendFromWallet,
  refundWallet,
  transferBetweenWallets,
  ensureWallet,
  InsufficientBalanceError,
} from '@/modules/wallet'

describe('wallet — use cases', () => {
  let repo: InMemoryWalletRepository

  beforeEach(() => {
    repo = new InMemoryWalletRepository()
  })

  async function newWallet(ownerId = 'org-1') {
    return repo.create({ ownerId, ownerType: 'organization' })
  }

  describe('ensureWallet', () => {
    it('cria wallet quando não existe', async () => {
      const w = await ensureWallet(
        { repo },
        { ownerId: 'o', ownerType: 'organization' },
      )
      expect(w.balanceUsd).toBe(0)
      expect(w.version).toBe(0)
    })

    it('é idempotente (retorna existente)', async () => {
      const w1 = await ensureWallet(
        { repo },
        { ownerId: 'o', ownerType: 'organization' },
      )
      const w2 = await ensureWallet(
        { repo },
        { ownerId: 'o', ownerType: 'organization' },
      )
      expect(w2.id).toBe(w1.id)
    })
  })

  describe('topUpWallet', () => {
    it('aumenta balanceUsd e registra txn', async () => {
      const w = await newWallet()
      const { wallet, transaction } = await topUpWallet(
        { repo },
        { walletId: w.id, amountUsd: 25.5, reason: 'stripe', createdBy: 'admin' },
      )
      expect(wallet.balanceUsd).toBe(25.5)
      expect(wallet.totalTopUps).toBe(25.5)
      expect(wallet.totalSpent).toBe(0)
      expect(wallet.version).toBe(1)
      expect(transaction.type).toBe('top_up')
      expect(transaction.amountUsd).toBe(25.5)
      expect(transaction.reason).toBe('stripe')
    })

    it('rejeita amount <= 0', async () => {
      const w = await newWallet()
      await expect(
        topUpWallet({ repo }, { walletId: w.id, amountUsd: 0 }),
      ).rejects.toThrow(/positive/)
    })

    it('dois top-ups acumulam', async () => {
      const w = await newWallet()
      await topUpWallet({ repo }, { walletId: w.id, amountUsd: 10 })
      const { wallet } = await topUpWallet(
        { repo },
        { walletId: w.id, amountUsd: 15 },
      )
      expect(wallet.balanceUsd).toBe(25)
      expect(wallet.totalTopUps).toBe(25)
      expect(wallet.version).toBe(2)
    })
  })

  describe('spendFromWallet', () => {
    it('reduz balanceUsd e acumula totalSpent', async () => {
      const w = await newWallet()
      await topUpWallet({ repo }, { walletId: w.id, amountUsd: 50 })
      const { wallet, transaction } = await spendFromWallet(
        { repo },
        {
          walletId: w.id,
          amountUsd: 12.3456,
          reason: 'video-gen',
          metadata: { engineId: 'seedance' },
        },
      )
      expect(wallet.balanceUsd).toBeCloseTo(37.6544, 4)
      expect(wallet.totalSpent).toBeCloseTo(12.3456, 4)
      expect(transaction.type).toBe('spend')
      expect(transaction.metadata).toEqual({ engineId: 'seedance' })
    })

    it('lança InsufficientBalanceError sem saldo', async () => {
      const w = await newWallet()
      await expect(
        spendFromWallet({ repo }, { walletId: w.id, amountUsd: 1, reason: 'x' }),
      ).rejects.toThrow(InsufficientBalanceError)
    })

    it('lança InsufficientBalanceError quando excede saldo', async () => {
      const w = await newWallet()
      await topUpWallet({ repo }, { walletId: w.id, amountUsd: 5 })
      try {
        await spendFromWallet(
          { repo },
          { walletId: w.id, amountUsd: 10, reason: 'x' },
        )
        throw new Error('expected throw')
      } catch (err) {
        expect(err).toBeInstanceOf(InsufficientBalanceError)
        expect((err as InsufficientBalanceError).balance).toBe(5)
        expect((err as InsufficientBalanceError).required).toBe(10)
      }
    })

    it('após falha, saldo permanece intacto', async () => {
      const w = await newWallet()
      await topUpWallet({ repo }, { walletId: w.id, amountUsd: 5 })
      try {
        await spendFromWallet(
          { repo },
          { walletId: w.id, amountUsd: 10, reason: 'x' },
        )
      } catch {
        /* ignore */
      }
      const current = await repo.findById(w.id)
      expect(current?.balanceUsd).toBe(5)
      expect(current?.totalSpent).toBe(0) // não acumulou — falhou antes do commit
      expect(current?.version).toBe(1) // só o top-up bumpou
    })
  })

  describe('refundWallet', () => {
    it('credita de volta como refund', async () => {
      const w = await newWallet()
      await topUpWallet({ repo }, { walletId: w.id, amountUsd: 20 })
      await spendFromWallet(
        { repo },
        { walletId: w.id, amountUsd: 7, reason: 'bug' },
      )
      const { wallet } = await refundWallet(
        { repo },
        {
          walletId: w.id,
          amountUsd: 7,
          reason: 'refund bug-123',
          metadata: { origTxn: 'tx-123' },
        },
      )
      expect(wallet.balanceUsd).toBe(20)
    })
  })

  describe('transferBetweenWallets', () => {
    it('debita from + credita to atomicamente', async () => {
      const a = await repo.create({ ownerId: 'a', ownerType: 'organization' })
      const b = await repo.create({ ownerId: 'b', ownerType: 'organization' })
      await topUpWallet({ repo }, { walletId: a.id, amountUsd: 50 })

      const result = await transferBetweenWallets(
        { repo },
        {
          fromWalletId: a.id,
          toWalletId: b.id,
          amountUsd: 30,
          reason: 'budget share',
        },
      )
      expect(result.fromWallet.balanceUsd).toBe(20)
      expect(result.toWallet.balanceUsd).toBe(30)
      expect(result.outTransaction.type).toBe('transfer_out')
      expect(result.inTransaction.type).toBe('transfer_in')
    })

    it('se from insuficiente, rollback — nada muda em nenhuma wallet', async () => {
      const a = await repo.create({ ownerId: 'a', ownerType: 'organization' })
      const b = await repo.create({ ownerId: 'b', ownerType: 'organization' })
      await topUpWallet({ repo }, { walletId: a.id, amountUsd: 5 })

      await expect(
        transferBetweenWallets(
          { repo },
          {
            fromWalletId: a.id,
            toWalletId: b.id,
            amountUsd: 20,
          },
        ),
      ).rejects.toThrow(InsufficientBalanceError)

      const aFinal = await repo.findById(a.id)
      const bFinal = await repo.findById(b.id)
      expect(aFinal?.balanceUsd).toBe(5)
      expect(bFinal?.balanceUsd).toBe(0)
    })

    it('rejeita transferência para mesma wallet', async () => {
      const w = await newWallet()
      await expect(
        transferBetweenWallets(
          { repo },
          { fromWalletId: w.id, toWalletId: w.id, amountUsd: 1 },
        ),
      ).rejects.toThrow(/same wallet/)
    })

    it('rejeita amount <= 0', async () => {
      const a = await repo.create({ ownerId: 'a', ownerType: 'organization' })
      const b = await repo.create({ ownerId: 'b', ownerType: 'organization' })
      await expect(
        transferBetweenWallets(
          { repo },
          { fromWalletId: a.id, toWalletId: b.id, amountUsd: 0 },
        ),
      ).rejects.toThrow(/positive/)
    })
  })

  describe('listTransactions', () => {
    it('lista por wallet incluindo todos os types', async () => {
      const w = await newWallet()
      await topUpWallet({ repo }, { walletId: w.id, amountUsd: 10 })
      await topUpWallet({ repo }, { walletId: w.id, amountUsd: 20 })
      await spendFromWallet(
        { repo },
        { walletId: w.id, amountUsd: 5, reason: 'x' },
      )
      const list = await repo.listTransactions(w.id)
      expect(list).toHaveLength(3)
      const types = list.map((t) => t.type).sort()
      expect(types).toEqual(['spend', 'top_up', 'top_up'])
    })

    it('filtra por type', async () => {
      const w = await newWallet()
      await topUpWallet({ repo }, { walletId: w.id, amountUsd: 10 })
      await topUpWallet({ repo }, { walletId: w.id, amountUsd: 20 })
      await spendFromWallet(
        { repo },
        { walletId: w.id, amountUsd: 5, reason: 'x' },
      )
      expect(await repo.listTransactions(w.id, { type: 'top_up' })).toHaveLength(
        2,
      )
      expect(await repo.listTransactions(w.id, { type: 'spend' })).toHaveLength(
        1,
      )
    })

    it('respeita limit', async () => {
      const w = await newWallet()
      for (let i = 0; i < 5; i++) {
        await topUpWallet({ repo }, { walletId: w.id, amountUsd: 1 })
      }
      expect(await repo.listTransactions(w.id, { limit: 2 })).toHaveLength(2)
    })
  })

  describe('expectedVersion optimistic lock', () => {
    it('rejeita quando version não bate', async () => {
      const w = await newWallet()
      await topUpWallet({ repo }, { walletId: w.id, amountUsd: 10 })
      // Agora version=1, mas tentamos aplicar com expectedVersion=0
      await expect(
        repo.applyTransaction({
          walletId: w.id,
          type: 'spend',
          amountUsd: 5,
          reason: 'x',
          expectedVersion: 0,
        }),
      ).rejects.toThrow(/version mismatch/)
    })
  })

  describe('adjustment (caso especial)', () => {
    it('aceita signedDelta positivo', async () => {
      const w = await newWallet()
      await topUpWallet({ repo }, { walletId: w.id, amountUsd: 10 })
      const { wallet } = await repo.applyTransaction({
        walletId: w.id,
        type: 'adjustment',
        amountUsd: 3,
        signedDelta: 3,
        reason: 'manual correction',
      })
      expect(wallet.balanceUsd).toBe(13)
      // adjustment NÃO altera totalTopUps/totalSpent
      expect(wallet.totalTopUps).toBe(10)
      expect(wallet.totalSpent).toBe(0)
    })

    it('aceita signedDelta negativo', async () => {
      const w = await newWallet()
      await topUpWallet({ repo }, { walletId: w.id, amountUsd: 10 })
      const { wallet } = await repo.applyTransaction({
        walletId: w.id,
        type: 'adjustment',
        amountUsd: 2,
        signedDelta: -2,
        reason: 'claw-back',
      })
      expect(wallet.balanceUsd).toBe(8)
    })

    it('bloqueia adjustment que deixaria saldo < 0', async () => {
      const w = await newWallet()
      await topUpWallet({ repo }, { walletId: w.id, amountUsd: 5 })
      await expect(
        repo.applyTransaction({
          walletId: w.id,
          type: 'adjustment',
          amountUsd: 100,
          signedDelta: -100,
          reason: 'x',
        }),
      ).rejects.toThrow(InsufficientBalanceError)
    })
  })
})
