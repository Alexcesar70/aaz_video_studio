import { describe, it, expect } from 'vitest'
import {
  validateWallet,
  validateWalletTransaction,
  computeSignedDelta,
  isCreditType,
  isDebitType,
  InvalidWalletError,
  InvalidWalletTransactionError,
  WALLET_TRANSACTION_TYPES,
} from '@/modules/wallet'

describe('Wallet domain', () => {
  describe('validateWallet', () => {
    it('aceita wallet válida', () => {
      const w = validateWallet({
        id: 'wlt-1',
        ownerId: 'org-1',
        ownerType: 'organization',
        balanceUsd: 0,
        totalTopUps: 0,
        totalSpent: 0,
        version: 0,
      })
      expect(w.alertThresholds.warning).toBe(20)
    })

    it('rejeita balanceUsd negativo', () => {
      expect(() =>
        validateWallet({
          id: 'x',
          ownerId: 'x',
          ownerType: 'user',
          balanceUsd: -1,
          totalTopUps: 0,
          totalSpent: 0,
          version: 0,
        }),
      ).toThrow(InvalidWalletError)
    })

    it('rejeita version negativo', () => {
      expect(() =>
        validateWallet({
          id: 'x',
          ownerId: 'x',
          ownerType: 'user',
          balanceUsd: 0,
          totalTopUps: 0,
          totalSpent: 0,
          version: -1,
        }),
      ).toThrow(/version/)
    })

    it('rejeita ownerType inválido', () => {
      expect(() =>
        validateWallet({
          id: 'x',
          ownerId: 'x',
          ownerType: 'weird' as never,
          balanceUsd: 0,
          totalTopUps: 0,
          totalSpent: 0,
          version: 0,
        }),
      ).toThrow(/ownerType/)
    })
  })

  describe('validateWalletTransaction', () => {
    it('aceita txn válida', () => {
      const t = validateWalletTransaction({
        id: 't-1',
        walletId: 'wlt-1',
        type: 'top_up',
        amountUsd: 10,
      })
      expect(t.type).toBe('top_up')
      expect(t.reason).toBe('')
    })

    it('rejeita amountUsd negativo', () => {
      expect(() =>
        validateWalletTransaction({
          id: 't',
          walletId: 'w',
          type: 'top_up',
          amountUsd: -1,
        }),
      ).toThrow(InvalidWalletTransactionError)
    })

    it('rejeita type inválido', () => {
      expect(() =>
        validateWalletTransaction({
          id: 't',
          walletId: 'w',
          type: 'donate' as never,
          amountUsd: 1,
        }),
      ).toThrow(/type/)
    })
  })

  describe('computeSignedDelta', () => {
    it('credit types retornam +amount', () => {
      expect(computeSignedDelta('top_up', 10)).toBe(10)
      expect(computeSignedDelta('refund', 5)).toBe(5)
      expect(computeSignedDelta('transfer_in', 7)).toBe(7)
      expect(computeSignedDelta('monthly_credit', 100)).toBe(100)
    })

    it('debit types retornam -amount', () => {
      expect(computeSignedDelta('spend', 10)).toBe(-10)
      expect(computeSignedDelta('transfer_out', 5)).toBe(-5)
    })

    it('adjustment requer signedDelta explícito', () => {
      expect(() => computeSignedDelta('adjustment', 10)).toThrow(
        InvalidWalletTransactionError,
      )
      expect(computeSignedDelta('adjustment', 10, 3.5)).toBe(3.5)
      expect(computeSignedDelta('adjustment', 10, -2)).toBe(-2)
    })
  })

  describe('isCreditType / isDebitType', () => {
    it('classifica types corretamente', () => {
      expect(isCreditType('top_up')).toBe(true)
      expect(isCreditType('refund')).toBe(true)
      expect(isCreditType('spend')).toBe(false)

      expect(isDebitType('spend')).toBe(true)
      expect(isDebitType('transfer_out')).toBe(true)
      expect(isDebitType('top_up')).toBe(false)

      // adjustment não é nem credit nem debit fixo
      expect(isCreditType('adjustment')).toBe(false)
      expect(isDebitType('adjustment')).toBe(false)
    })
  })

  describe('WALLET_TRANSACTION_TYPES', () => {
    it('expõe os 7 types', () => {
      expect(WALLET_TRANSACTION_TYPES).toEqual([
        'top_up',
        'spend',
        'transfer_in',
        'transfer_out',
        'refund',
        'adjustment',
        'monthly_credit',
      ])
    })
  })
})
