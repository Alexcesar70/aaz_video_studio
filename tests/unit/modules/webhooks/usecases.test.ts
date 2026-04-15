import { describe, it, expect, beforeEach, vi } from 'vitest'
import { randomUUID } from 'crypto'
import {
  subscribeWebhook,
  unsubscribeWebhook,
  listWebhookSubscriptions,
  getWebhookSubscription,
  updateWebhookSubscription,
  rotateWebhookSecret,
  WebhookNotificationSender,
  shouldDeliver,
  validateWebhookSubscription,
  generateWebhookSecret,
  signPayload,
  InvalidWebhookSubscriptionError,
  WebhookSubscriptionNotFoundError,
  InMemoryWebhookSubscriptionRepository,
  type WebhookSubscription,
} from '@/modules/webhooks'
import type { Notification } from '@/modules/notifications'

function buildSub(
  overrides: Partial<WebhookSubscription> = {},
): WebhookSubscription {
  return validateWebhookSubscription(
    {
      id: randomUUID(),
      workspaceId: 'aaz',
      url: 'https://hooks.example.com/x',
      secret: generateWebhookSecret(),
      kinds: [],
      active: true,
      consecutiveFailures: 0,
      ...overrides,
    },
  )
}

function buildNotification(
  overrides: Partial<Notification> = {},
): Notification {
  return {
    id: randomUUID(),
    kind: 'episode_approved',
    level: 'info',
    userId: 'alice',
    workspaceId: 'aaz',
    title: 'OK',
    body: 'Aprovado.',
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('webhook validation', () => {
  it('aceita https URL', () => {
    expect(() => buildSub({ url: 'https://x.com/y' })).not.toThrow()
  })

  it('rejeita http URL em produção', () => {
    expect(() =>
      validateWebhookSubscription({
        id: '12345678-1234-4234-8234-123456789abc',
        workspaceId: 'ws',
        url: 'http://insecure.com/x',
        secret: generateWebhookSecret(),
        active: true,
        consecutiveFailures: 0,
      }),
    ).toThrow(InvalidWebhookSubscriptionError)
  })

  it('aceita http URL com allowInsecureUrl=true', () => {
    expect(() =>
      validateWebhookSubscription(
        {
          id: '12345678-1234-4234-8234-123456789abc',
          workspaceId: 'ws',
          url: 'http://localhost:3000/x',
          secret: generateWebhookSecret(),
          active: true,
          consecutiveFailures: 0,
        },
        { allowInsecureUrl: true },
      ),
    ).not.toThrow()
  })

  it('rejeita protocolos não-http', () => {
    expect(() =>
      validateWebhookSubscription({
        id: '12345678-1234-4234-8234-123456789abc',
        workspaceId: 'ws',
        url: 'ftp://x.com/x',
        secret: generateWebhookSecret(),
        active: true,
        consecutiveFailures: 0,
      }),
    ).toThrow()
  })

  it('rejeita secret de tamanho errado', () => {
    expect(() =>
      validateWebhookSubscription({
        id: '12345678-1234-4234-8234-123456789abc',
        workspaceId: 'ws',
        url: 'https://x.com',
        secret: 'short',
        active: true,
        consecutiveFailures: 0,
      }),
    ).toThrow(/secret/)
  })

  it('rejeita id não-uuid', () => {
    expect(() =>
      validateWebhookSubscription({
        id: 'nope',
        workspaceId: 'ws',
        url: 'https://x.com',
        secret: generateWebhookSecret(),
        active: true,
        consecutiveFailures: 0,
      }),
    ).toThrow(/uuid/)
  })
})

describe('shouldDeliver', () => {
  it('subscription inativa NUNCA recebe', () => {
    const s = buildSub({ active: false })
    expect(shouldDeliver(s, 'episode_approved')).toBe(false)
  })

  it('kinds vazio = recebe todos', () => {
    const s = buildSub({ kinds: [] })
    expect(shouldDeliver(s, 'episode_approved')).toBe(true)
    expect(shouldDeliver(s, 'wallet_low_balance')).toBe(true)
  })

  it('kinds específicos = só recebe os listados', () => {
    const s = buildSub({ kinds: ['episode_approved', 'job_failed'] })
    expect(shouldDeliver(s, 'episode_approved')).toBe(true)
    expect(shouldDeliver(s, 'job_failed')).toBe(true)
    expect(shouldDeliver(s, 'wallet_low_balance')).toBe(false)
  })
})

describe('subscribeWebhook', () => {
  let repo: InMemoryWebhookSubscriptionRepository
  beforeEach(() => {
    repo = new InMemoryWebhookSubscriptionRepository()
  })

  it('cria subscription com secret novo', async () => {
    const r = await subscribeWebhook(
      { repo },
      {
        workspaceId: 'aaz',
        url: 'https://x.com',
        kinds: ['episode_approved'],
        createdBy: 'alice',
      },
    )
    expect(r.subscription.workspaceId).toBe('aaz')
    expect(r.secret).toMatch(/^[0-9a-f]{64}$/)
    expect(r.subscription.secret).toBe(r.secret)
    expect(r.subscription.active).toBe(true)
    expect(r.subscription.consecutiveFailures).toBe(0)
  })

  it('persiste no repo (busca recupera)', async () => {
    const r = await subscribeWebhook(
      { repo },
      { workspaceId: 'aaz', url: 'https://x.com' },
    )
    const found = await repo.findById(r.subscription.id)
    expect(found?.url).toBe('https://x.com')
  })

  it('lista do workspace', async () => {
    await subscribeWebhook({ repo }, { workspaceId: 'aaz', url: 'https://a.com' })
    await subscribeWebhook({ repo }, { workspaceId: 'aaz', url: 'https://b.com' })
    await subscribeWebhook({ repo }, { workspaceId: 'other', url: 'https://c.com' })
    const aazSubs = await listWebhookSubscriptions(
      { repo },
      { workspaceId: 'aaz' },
    )
    expect(aazSubs).toHaveLength(2)
    // Public listing OMITE secret
    expect('secret' in (aazSubs[0] as Record<string, unknown>)).toBe(false)
  })
})

describe('updateWebhookSubscription', () => {
  let repo: InMemoryWebhookSubscriptionRepository
  beforeEach(() => {
    repo = new InMemoryWebhookSubscriptionRepository()
  })

  it('atualiza url + kinds + active', async () => {
    const r = await subscribeWebhook(
      { repo },
      { workspaceId: 'aaz', url: 'https://old.com' },
    )
    const updated = await updateWebhookSubscription(
      { repo },
      {
        id: r.subscription.id,
        url: 'https://new.com',
        kinds: ['job_failed'],
        active: false,
      },
    )
    expect(updated.url).toBe('https://new.com')
    expect(updated.kinds).toEqual(['job_failed'])
    expect(updated.active).toBe(false)
  })

  it('reativar reseta consecutiveFailures', async () => {
    const r = await subscribeWebhook(
      { repo },
      { workspaceId: 'aaz', url: 'https://x.com' },
    )
    // Simula falhas
    await repo.upsert({
      ...r.subscription,
      consecutiveFailures: 5,
      active: false,
    })
    const reactivated = await updateWebhookSubscription(
      { repo },
      { id: r.subscription.id, active: true },
    )
    expect(reactivated.consecutiveFailures).toBe(0)
    expect(reactivated.active).toBe(true)
  })

  it('lança WebhookSubscriptionNotFoundError', async () => {
    await expect(
      updateWebhookSubscription(
        { repo },
        { id: '12345678-1234-4234-8234-123456789abc' },
      ),
    ).rejects.toThrow(WebhookSubscriptionNotFoundError)
  })
})

describe('rotateWebhookSecret', () => {
  let repo: InMemoryWebhookSubscriptionRepository
  beforeEach(() => {
    repo = new InMemoryWebhookSubscriptionRepository()
  })

  it('gera novo secret distinto do anterior', async () => {
    const r = await subscribeWebhook(
      { repo },
      { workspaceId: 'aaz', url: 'https://x.com' },
    )
    const original = r.subscription.secret
    const rotated = await rotateWebhookSecret({ repo }, r.subscription.id)
    expect(rotated.newSecret).toMatch(/^[0-9a-f]{64}$/)
    expect(rotated.newSecret).not.toBe(original)
    expect(rotated.subscription.secret).toBe(rotated.newSecret)
  })
})

describe('unsubscribeWebhook', () => {
  it('remove do repo', async () => {
    const repo = new InMemoryWebhookSubscriptionRepository()
    const r = await subscribeWebhook(
      { repo },
      { workspaceId: 'aaz', url: 'https://x.com' },
    )
    await unsubscribeWebhook({ repo }, r.subscription.id)
    expect(await repo.findById(r.subscription.id)).toBeNull()
  })
})

describe('getWebhookSubscription (public, sem secret)', () => {
  it('omite secret', async () => {
    const repo = new InMemoryWebhookSubscriptionRepository()
    const r = await subscribeWebhook(
      { repo },
      { workspaceId: 'aaz', url: 'https://x.com' },
    )
    const pub = await getWebhookSubscription({ repo }, r.subscription.id)
    expect(pub).not.toBeNull()
    expect('secret' in (pub as Record<string, unknown>)).toBe(false)
  })
})

describe('WebhookNotificationSender', () => {
  let repo: InMemoryWebhookSubscriptionRepository
  beforeEach(() => {
    repo = new InMemoryWebhookSubscriptionRepository()
  })

  it('POSTa para todas subscriptions ativas que casam com kind', async () => {
    const r1 = await subscribeWebhook(
      { repo },
      { workspaceId: 'aaz', url: 'https://a.com', kinds: ['episode_approved'] },
    )
    const r2 = await subscribeWebhook(
      { repo },
      { workspaceId: 'aaz', url: 'https://b.com', kinds: [] }, // todos
    )
    await subscribeWebhook(
      { repo },
      { workspaceId: 'aaz', url: 'https://c.com', kinds: ['job_failed'] },
    )

    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }))
    const sender = new WebhookNotificationSender({
      repo,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    await sender.send(buildNotification({ kind: 'episode_approved' }))

    // Apenas r1 e r2 devem ter recebido
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const urls = fetchImpl.mock.calls.map((c) => c[0])
    expect(urls).toContain('https://a.com')
    expect(urls).toContain('https://b.com')
    expect(urls).not.toContain('https://c.com')

    void r1
    void r2
  })

  it('inclui header X-Webhook-Signature válido', async () => {
    const r = await subscribeWebhook(
      { repo },
      { workspaceId: 'aaz', url: 'https://x.com' },
    )
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }))
    const sender = new WebhookNotificationSender({
      repo,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const n = buildNotification()
    await sender.send(n)
    const init = fetchImpl.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    const sig = headers['X-Webhook-Signature']
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/)
    // Verifica que a assinatura é válida pra esse body
    const body = init.body as string
    expect(signPayload(body, r.subscription.secret)).toBe(sig)
  })

  it('inclui X-Webhook-Id com notification id (idempotency)', async () => {
    await subscribeWebhook(
      { repo },
      { workspaceId: 'aaz', url: 'https://x.com' },
    )
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }))
    const sender = new WebhookNotificationSender({
      repo,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const n = buildNotification()
    await sender.send(n)
    const headers = (fetchImpl.mock.calls[0][1] as RequestInit)
      .headers as Record<string, string>
    expect(headers['X-Webhook-Id']).toBe(n.id)
  })

  it('falha individual NÃO bloqueia outras subscriptions', async () => {
    await subscribeWebhook(
      { repo },
      { workspaceId: 'aaz', url: 'https://fail.com' },
    )
    await subscribeWebhook(
      { repo },
      { workspaceId: 'aaz', url: 'https://ok.com' },
    )
    const fetchImpl = vi.fn().mockImplementation((url: string) => {
      if (url === 'https://fail.com') {
        return Promise.reject(new Error('connection refused'))
      }
      return Promise.resolve(new Response(null, { status: 200 }))
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sender = new WebhookNotificationSender({
      repo,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(sender.send(buildNotification())).resolves.toBeUndefined()
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    warnSpy.mockRestore()
  })

  it('auto-pausa após maxConsecutiveFailures', async () => {
    const r = await subscribeWebhook(
      { repo },
      { workspaceId: 'aaz', url: 'https://fail.com' },
    )
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, { status: 500 }),
    )
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sender = new WebhookNotificationSender({
      repo,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxConsecutiveFailures: 3,
    })
    // 3 falhas consecutivas
    for (let i = 0; i < 3; i++) {
      await sender.send(buildNotification())
    }
    const after = await repo.findById(r.subscription.id)
    expect(after?.consecutiveFailures).toBe(3)
    expect(after?.active).toBe(false) // auto-pausada
    warnSpy.mockRestore()
  })

  it('sucesso reseta consecutiveFailures', async () => {
    const r = await subscribeWebhook(
      { repo },
      { workspaceId: 'aaz', url: 'https://x.com' },
    )
    // Pré-set 2 failures
    await repo.upsert({ ...r.subscription, consecutiveFailures: 2 })
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    )
    const sender = new WebhookNotificationSender({
      repo,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await sender.send(buildNotification())
    const after = await repo.findById(r.subscription.id)
    expect(after?.consecutiveFailures).toBe(0)
    expect(after?.lastDeliveryStatus).toBe('success')
  })

  it('notification SEM workspaceId é no-op', async () => {
    const fetchImpl = vi.fn()
    const sender = new WebhookNotificationSender({
      repo,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await sender.send(buildNotification({ workspaceId: null }))
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
