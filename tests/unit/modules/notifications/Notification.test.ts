import { describe, it, expect } from 'vitest'
import { randomUUID } from 'crypto'
import {
  validateNotification,
  markRead,
  InvalidNotificationError,
  NOTIFICATION_KINDS,
  NOTIFICATION_LEVELS,
} from '@/modules/notifications'

function base(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: randomUUID(),
    kind: 'wallet_low_balance' as const,
    level: 'warning' as const,
    userId: 'alice',
    workspaceId: 'aaz',
    title: 'Saldo baixo',
    body: 'Você tem $5 restantes.',
    ...overrides,
  }
}

describe('Notification domain', () => {
  describe('validateNotification', () => {
    it('aceita minimal válido', () => {
      const n = validateNotification(base())
      expect(n.kind).toBe('wallet_low_balance')
      expect(n.readAt).toBeNull()
      expect(n.createdAt).toBeTruthy()
    })

    it('aceita workspaceId null (notificação de sistema)', () => {
      const n = validateNotification(base({ workspaceId: null }))
      expect(n.workspaceId).toBeNull()
    })

    it('rejeita id não-uuid', () => {
      expect(() => validateNotification(base({ id: 'nope' }))).toThrow(
        InvalidNotificationError,
      )
    })

    it('rejeita kind inválido', () => {
      expect(() =>
        validateNotification(base({ kind: 'unknown' as never })),
      ).toThrow(/kind/)
    })

    it('rejeita level inválido', () => {
      expect(() =>
        validateNotification(base({ level: 'fatal' as never })),
      ).toThrow(/level/)
    })

    it('rejeita userId vazio', () => {
      expect(() => validateNotification(base({ userId: '' }))).toThrow(
        /userId/,
      )
    })

    it('rejeita title vazio', () => {
      expect(() => validateNotification(base({ title: '   ' }))).toThrow(
        /title/,
      )
    })

    it('rejeita title > 80 chars', () => {
      expect(() =>
        validateNotification(base({ title: 'x'.repeat(81) })),
      ).toThrow(/excede 80/)
    })

    it('rejeita body vazio', () => {
      expect(() => validateNotification(base({ body: '' }))).toThrow(/body/)
    })

    it('rejeita body > 500 chars', () => {
      expect(() =>
        validateNotification(base({ body: 'x'.repeat(501) })),
      ).toThrow(/excede 500/)
    })

    it('rejeita link sem href ou label', () => {
      expect(() =>
        validateNotification(
          base({ link: { href: '', label: 'X' } as unknown as Record<string, string> }),
        ),
      ).toThrow(/link/)
      expect(() =>
        validateNotification(
          base({ link: { href: '/x', label: '' } as unknown as Record<string, string> }),
        ),
      ).toThrow(/link/)
    })

    it('aceita link válido', () => {
      const n = validateNotification(
        base({ link: { href: '/admin/wallet', label: 'Adicionar' } }),
      )
      expect(n.link?.href).toBe('/admin/wallet')
    })

    it('preserva metadata arbitrária', () => {
      const n = validateNotification(
        base({ metadata: { walletId: 'w-1', amount: 5 } }),
      )
      expect(n.metadata).toEqual({ walletId: 'w-1', amount: 5 })
    })

    it('trim no title', () => {
      const n = validateNotification(base({ title: '  Saldo baixo  ' }))
      expect(n.title).toBe('Saldo baixo')
    })
  })

  describe('markRead', () => {
    it('seta readAt quando ainda não-lida', () => {
      const n = validateNotification(base())
      const r = markRead(n)
      expect(r.readAt).toBeTruthy()
    })

    it('idempotente: não altera readAt se já lida', () => {
      const n = validateNotification(base({ readAt: '2025-01-01T00:00:00.000Z' }))
      const r = markRead(n)
      expect(r.readAt).toBe('2025-01-01T00:00:00.000Z')
      expect(r).toBe(n) // mesma referência
    })
  })

  describe('constants', () => {
    it('NOTIFICATION_KINDS contém os 12 kinds', () => {
      expect(NOTIFICATION_KINDS.length).toBe(12)
      expect(NOTIFICATION_KINDS).toContain('wallet_low_balance')
      expect(NOTIFICATION_KINDS).toContain('episode_approved')
      expect(NOTIFICATION_KINDS).toContain('job_failed')
    })

    it('NOTIFICATION_LEVELS contém info, warning, critical', () => {
      expect(NOTIFICATION_LEVELS).toEqual(['info', 'warning', 'critical'])
    })
  })
})
