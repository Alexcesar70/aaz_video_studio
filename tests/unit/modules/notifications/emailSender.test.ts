import { describe, it, expect, vi } from 'vitest'
import { randomUUID } from 'crypto'
import {
  EmailNotificationSender,
  RecordingEmailDeliverer,
  ConsoleEmailDeliverer,
  ResendEmailDeliverer,
  type EmailMessage,
} from '@/modules/notifications'
import type { Notification } from '@/modules/notifications'

function buildNotification(
  overrides: Partial<Notification> = {},
): Notification {
  return {
    id: randomUUID(),
    kind: 'wallet_low_balance',
    level: 'warning',
    userId: 'alice',
    workspaceId: 'aaz',
    title: 'Saldo baixo',
    body: 'Sua wallet tem $5 restantes.',
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('EmailNotificationSender', () => {
  it('envia email com to/from/subject/html/text via deliverer', async () => {
    const deliverer = new RecordingEmailDeliverer()
    const sender = new EmailNotificationSender({
      recipientResolver: async () => 'alice@aaz.com',
      emailDeliverer: deliverer,
      defaultFrom: 'noreply@aaz.app',
    })
    await sender.send(buildNotification())
    expect(deliverer.sent).toHaveLength(1)
    const msg = deliverer.sent[0]
    expect(msg.to).toBe('alice@aaz.com')
    expect(msg.from).toBe('noreply@aaz.app')
    expect(msg.subject).toContain('Saldo baixo')
    expect(msg.html).toContain('Saldo baixo')
    expect(msg.text).toContain('Sua wallet')
  })

  it('inclui tags com kind/level/workspaceId', async () => {
    const deliverer = new RecordingEmailDeliverer()
    const sender = new EmailNotificationSender({
      recipientResolver: async () => 'alice@aaz.com',
      emailDeliverer: deliverer,
      defaultFrom: 'x@y',
    })
    await sender.send(buildNotification())
    expect(deliverer.sent[0].tags).toEqual({
      kind: 'wallet_low_balance',
      level: 'warning',
      workspaceId: 'aaz',
    })
  })

  it('aplica subjectFormatter customizado', async () => {
    const deliverer = new RecordingEmailDeliverer()
    const sender = new EmailNotificationSender({
      recipientResolver: async () => 'alice@aaz.com',
      emailDeliverer: deliverer,
      defaultFrom: 'x@y',
      subjectFormatter: (n) => `🔔 ${n.title}`,
    })
    await sender.send(buildNotification())
    expect(deliverer.sent[0].subject).toBe('🔔 Saldo baixo')
  })

  it('NÃO envia + chama onSkip se recipient null', async () => {
    const deliverer = new RecordingEmailDeliverer()
    const skips: Array<{ id: string; reason: string }> = []
    const sender = new EmailNotificationSender({
      recipientResolver: async () => null,
      emailDeliverer: deliverer,
      defaultFrom: 'x@y',
      onSkip: (n, reason) => skips.push({ id: n.id, reason }),
    })
    const n = buildNotification()
    await sender.send(n)
    expect(deliverer.sent).toHaveLength(0)
    expect(skips).toHaveLength(1)
    expect(skips[0].reason).toBe('recipient_not_found')
  })

  it('propaga erro do deliverer (Inngest faz retry)', async () => {
    const deliverer = {
      send: async () => {
        throw new Error('Resend timeout')
      },
    }
    const sender = new EmailNotificationSender({
      recipientResolver: async () => 'alice@aaz.com',
      emailDeliverer: deliverer,
      defaultFrom: 'x@y',
    })
    await expect(sender.send(buildNotification())).rejects.toThrow(/Resend/)
  })

  it('renderiza HTML escaping títulos com caracteres perigosos', async () => {
    const deliverer = new RecordingEmailDeliverer()
    const sender = new EmailNotificationSender({
      recipientResolver: async () => 'alice@aaz.com',
      emailDeliverer: deliverer,
      defaultFrom: 'x@y',
    })
    await sender.send(
      buildNotification({
        title: '<script>alert(1)</script>',
        body: 'Plain & simple',
      }),
    )
    expect(deliverer.sent[0].html).not.toContain('<script>')
    expect(deliverer.sent[0].html).toContain('&lt;script&gt;')
    expect(deliverer.sent[0].html).toContain('Plain &amp; simple')
  })

  it('inclui link button quando notification.link presente', async () => {
    const deliverer = new RecordingEmailDeliverer()
    const sender = new EmailNotificationSender({
      recipientResolver: async () => 'alice@aaz.com',
      emailDeliverer: deliverer,
      defaultFrom: 'x@y',
    })
    await sender.send(
      buildNotification({
        link: { href: '/admin/wallet', label: 'Adicionar créditos' },
      }),
    )
    expect(deliverer.sent[0].html).toContain('Adicionar créditos')
    expect(deliverer.sent[0].html).toContain('href="/admin/wallet"')
    expect(deliverer.sent[0].text).toContain('/admin/wallet')
  })
})

describe('ConsoleEmailDeliverer', () => {
  it('printa JSON estruturado', async () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    await new ConsoleEmailDeliverer().send({
      to: 'a@b',
      from: 'c@d',
      subject: 'X',
      html: '<p>X</p>',
      text: 'X',
    })
    const payload = JSON.parse(spy.mock.calls[0][0] as string)
    expect(payload.type).toBe('email_send')
    expect(payload.to).toBe('a@b')
    spy.mockRestore()
  })
})

describe('ResendEmailDeliverer', () => {
  it('POST para /emails com Authorization Bearer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'e_1' }), { status: 200 }),
    )
    const d = new ResendEmailDeliverer({
      apiKey: 're_test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const msg: EmailMessage = {
      to: 'a@b',
      from: 'c@d',
      subject: 'X',
      html: '<p>X</p>',
      text: 'X',
      tags: { kind: 'system_announcement' },
    }
    await d.send(msg)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    const initObj = init as RequestInit
    expect(initObj.method).toBe('POST')
    const headers = initObj.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer re_test')
    const body = JSON.parse(initObj.body as string)
    expect(body.to).toBe('a@b')
    expect(body.tags).toEqual([{ name: 'kind', value: 'system_announcement' }])
  })

  it('lança quando API retorna não-2xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'invalid_email' }), { status: 422 }),
    )
    const d = new ResendEmailDeliverer({
      apiKey: 're_test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(
      d.send({ to: 'a', from: 'c@d', subject: 'X', html: 'X', text: 'X' }),
    ).rejects.toThrow(/HTTP 422.*invalid_email/)
  })

  it('exige from explícito (sem default)', async () => {
    const fetchImpl = vi.fn()
    const d = new ResendEmailDeliverer({
      apiKey: 're_test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(
      d.send({
        to: 'a@b',
        subject: 'X',
        html: 'X',
        text: 'X',
      } as EmailMessage),
    ).rejects.toThrow(/from é obrigatório/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
