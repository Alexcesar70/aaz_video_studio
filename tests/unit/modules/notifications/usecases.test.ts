import { describe, it, expect, beforeEach } from 'vitest'
import {
  createNotification,
  notify,
  listNotifications,
  countUnread,
  markNotificationRead,
  markAllNotificationsRead,
  removeNotification,
  InMemoryNotificationRepository,
  RecordingNotificationSender,
  CompositeNotificationSender,
  NoopNotificationSender,
  ConsoleNotificationSender,
} from '@/modules/notifications'

describe('notification use cases', () => {
  let repo: InMemoryNotificationRepository
  beforeEach(() => {
    repo = new InMemoryNotificationRepository()
  })

  describe('createNotification', () => {
    it('persiste notificação não-lida (readAt=null)', async () => {
      const n = await createNotification(
        { repo },
        {
          kind: 'wallet_low_balance',
          level: 'warning',
          userId: 'alice',
          workspaceId: 'aaz',
          title: 'Saldo baixo',
          body: 'Você tem $5.',
        },
      )
      expect(n.readAt).toBeNull()
      expect(await repo.findById(n.id)).not.toBeNull()
    })

    it('respeita id explícito (idempotência externa)', async () => {
      const id = '12345678-1234-4234-8234-123456789abc'
      const n = await createNotification(
        { repo },
        {
          id,
          kind: 'system_announcement',
          level: 'info',
          userId: 'alice',
          workspaceId: null,
          title: 'X',
          body: 'Y',
        },
      )
      expect(n.id).toBe(id)
    })
  })

  describe('notify (persist + send)', () => {
    it('persiste e envia via sender', async () => {
      const sender = new RecordingNotificationSender()
      const n = await notify(
        { repo, sender },
        {
          kind: 'episode_approved',
          level: 'info',
          userId: 'creator',
          workspaceId: 'aaz',
          title: 'Episódio aprovado',
          body: 'Seu episódio "Ep01" foi aprovado pelo admin.',
        },
      )
      expect(sender.sent).toHaveLength(1)
      expect(sender.sent[0].id).toBe(n.id)
    })

    it('falha do sender NÃO desfaz persistência (notificação fica visível)', async () => {
      const failing: import('@/modules/notifications').NotificationSender = {
        async send() {
          throw new Error('sender down')
        },
      }
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const n = await notify(
        { repo, sender: failing },
        {
          kind: 'system_announcement',
          level: 'info',
          userId: 'alice',
          workspaceId: null,
          title: 'X',
          body: 'Y',
        },
      )
      expect(await repo.findById(n.id)).not.toBeNull()
      expect(errSpy).toHaveBeenCalled()
      errSpy.mockRestore()
    })

    it('sem sender: persiste e retorna (caso "store-only")', async () => {
      const n = await notify(
        { repo },
        {
          kind: 'workspace_invitation',
          level: 'info',
          userId: 'bob',
          workspaceId: 'aaz',
          title: 'Convite',
          body: 'Você foi convidado para AAZ.',
        },
      )
      expect(await repo.findById(n.id)).not.toBeNull()
    })
  })

  describe('list + filters', () => {
    beforeEach(async () => {
      await notify(
        { repo },
        { kind: 'wallet_low_balance', level: 'warning', userId: 'alice', workspaceId: 'aaz', title: 'A', body: 'a' },
      )
      await notify(
        { repo },
        { kind: 'episode_approved', level: 'info', userId: 'alice', workspaceId: 'aaz', title: 'B', body: 'b' },
      )
      await notify(
        { repo },
        { kind: 'wallet_low_balance', level: 'warning', userId: 'bob', workspaceId: 'aaz', title: 'C', body: 'c' },
      )
    })

    it('filtra por userId obrigatoriamente', async () => {
      const aliceNotifs = await listNotifications({ repo }, { userId: 'alice' })
      expect(aliceNotifs).toHaveLength(2)
      const bobNotifs = await listNotifications({ repo }, { userId: 'bob' })
      expect(bobNotifs).toHaveLength(1)
    })

    it('filtra por kind', async () => {
      const wallet = await listNotifications(
        { repo },
        { userId: 'alice', kind: 'wallet_low_balance' },
      )
      expect(wallet).toHaveLength(1)
    })

    it('filtra por level', async () => {
      const warn = await listNotifications(
        { repo },
        { userId: 'alice', level: 'warning' },
      )
      expect(warn).toHaveLength(1)
    })

    it('filtra por unreadOnly', async () => {
      const unread = await listNotifications(
        { repo },
        { userId: 'alice', unreadOnly: true },
      )
      expect(unread).toHaveLength(2) // ambas começam não-lidas
    })

    it('respeita limit', async () => {
      const limited = await listNotifications(
        { repo },
        { userId: 'alice', limit: 1 },
      )
      expect(limited).toHaveLength(1)
    })
  })

  describe('countUnread', () => {
    it('conta apenas não-lidas do user', async () => {
      await notify(
        { repo },
        { kind: 'system_announcement', level: 'info', userId: 'alice', workspaceId: null, title: 'A', body: 'a' },
      )
      await notify(
        { repo },
        { kind: 'system_announcement', level: 'info', userId: 'alice', workspaceId: null, title: 'B', body: 'b' },
      )
      await notify(
        { repo },
        { kind: 'system_announcement', level: 'info', userId: 'bob', workspaceId: null, title: 'C', body: 'c' },
      )
      expect(await countUnread({ repo }, 'alice')).toBe(2)
      expect(await countUnread({ repo }, 'bob')).toBe(1)
    })
  })

  describe('markNotificationRead', () => {
    it('marca como lida e setta readAt', async () => {
      const n = await notify(
        { repo },
        {
          kind: 'system_announcement',
          level: 'info',
          userId: 'alice',
          workspaceId: null,
          title: 'A',
          body: 'a',
        },
      )
      const updated = await markNotificationRead(
        { repo },
        { id: n.id, userId: 'alice' },
      )
      expect(updated?.readAt).toBeTruthy()
    })

    it('retorna null se user não é owner (auth fail)', async () => {
      const n = await notify(
        { repo },
        {
          kind: 'system_announcement',
          level: 'info',
          userId: 'alice',
          workspaceId: null,
          title: 'A',
          body: 'a',
        },
      )
      const r = await markNotificationRead(
        { repo },
        { id: n.id, userId: 'bob' },
      )
      expect(r).toBeNull()
    })

    it('idempotente: marcar 2x não muda readAt', async () => {
      const n = await notify(
        { repo },
        {
          kind: 'system_announcement',
          level: 'info',
          userId: 'alice',
          workspaceId: null,
          title: 'A',
          body: 'a',
        },
      )
      const r1 = await markNotificationRead({ repo }, { id: n.id, userId: 'alice' })
      const r2 = await markNotificationRead({ repo }, { id: n.id, userId: 'alice' })
      expect(r1?.readAt).toBe(r2?.readAt)
    })
  })

  describe('markAllNotificationsRead', () => {
    it('retorna count e marca todas as não-lidas', async () => {
      for (let i = 0; i < 3; i++) {
        await notify(
          { repo },
          {
            kind: 'system_announcement',
            level: 'info',
            userId: 'alice',
            workspaceId: null,
            title: `T${i}`,
            body: `b${i}`,
          },
        )
      }
      const count = await markAllNotificationsRead({ repo }, 'alice')
      expect(count).toBe(3)
      expect(await countUnread({ repo }, 'alice')).toBe(0)
    })

    it('não toca notificações de outros users', async () => {
      await notify(
        { repo },
        { kind: 'system_announcement', level: 'info', userId: 'alice', workspaceId: null, title: 'A', body: 'a' },
      )
      await notify(
        { repo },
        { kind: 'system_announcement', level: 'info', userId: 'bob', workspaceId: null, title: 'B', body: 'b' },
      )
      await markAllNotificationsRead({ repo }, 'alice')
      expect(await countUnread({ repo }, 'bob')).toBe(1)
    })
  })

  describe('removeNotification', () => {
    it('remove com auth', async () => {
      const n = await notify(
        { repo },
        { kind: 'system_announcement', level: 'info', userId: 'alice', workspaceId: null, title: 'A', body: 'a' },
      )
      await removeNotification({ repo }, { id: n.id, userId: 'alice' })
      expect(await repo.findById(n.id)).toBeNull()
    })

    it('silently no-op se user errado tenta remover', async () => {
      const n = await notify(
        { repo },
        { kind: 'system_announcement', level: 'info', userId: 'alice', workspaceId: null, title: 'A', body: 'a' },
      )
      await removeNotification({ repo }, { id: n.id, userId: 'bob' })
      expect(await repo.findById(n.id)).not.toBeNull() // não deletado
    })
  })
})

describe('Senders', () => {
  it('NoopNotificationSender é silent', async () => {
    const s = new NoopNotificationSender()
    await expect(
      s.send({ id: 'x' } as never),
    ).resolves.toBeUndefined()
  })

  it('CompositeNotificationSender fan-out + erros via callback', async () => {
    const ok = new RecordingNotificationSender()
    const failing: import('@/modules/notifications').NotificationSender = {
      async send() {
        throw new Error('boom')
      },
    }
    const errors: Array<{ idx: number; err: unknown }> = []
    const composite = new CompositeNotificationSender(
      [ok, failing, ok],
      (err, idx) => errors.push({ idx, err }),
    )
    await composite.send({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'system_announcement',
      level: 'info',
      userId: 'alice',
      workspaceId: null,
      title: 'X',
      body: 'Y',
      readAt: null,
      createdAt: new Date().toISOString(),
    })
    expect(ok.sent).toHaveLength(2) // primeiro e terceiro
    expect(errors).toHaveLength(1)
    expect(errors[0].idx).toBe(1)
  })

  it('ConsoleNotificationSender printa JSON', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const s = new ConsoleNotificationSender()
    await s.send({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      kind: 'system_announcement',
      level: 'info',
      userId: 'alice',
      workspaceId: null,
      title: 'X',
      body: 'Y',
      readAt: null,
      createdAt: new Date().toISOString(),
    })
    expect(spy).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(spy.mock.calls[0][0] as string)
    expect(payload.type).toBe('notification_send')
    spy.mockRestore()
  })
})

import { vi } from 'vitest'
