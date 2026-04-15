import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ConsoleAnalyticsClient,
  NullAnalyticsClient,
  RecordingAnalyticsClient,
  setAnalyticsClient,
  getAnalyticsClient,
  identify,
  track,
  resetAnalytics,
} from '@/lib/analytics'

describe('NullAnalyticsClient', () => {
  it('é seguro chamar todos os métodos sem efeito', () => {
    const c = new NullAnalyticsClient()
    expect(() => c.identify('u')).not.toThrow()
    expect(() => c.track('evt')).not.toThrow()
    expect(() => c.reset()).not.toThrow()
  })
})

describe('RecordingAnalyticsClient', () => {
  it('grava chamadas em listas inspetáveis', () => {
    const c = new RecordingAnalyticsClient()
    c.identify('alice', { role: 'admin' })
    c.track('login', { method: 'password' })
    c.reset()

    expect(c.identifies).toEqual([
      { userId: 'alice', traits: { role: 'admin' } },
    ])
    expect(c.tracks).toEqual([
      { event: 'login', properties: { method: 'password' } },
    ])
    expect(c.resets).toBe(1)
  })

  it('clear() limpa todas as listas', () => {
    const c = new RecordingAnalyticsClient()
    c.identify('a')
    c.track('x')
    c.reset()
    c.clear()
    expect(c.identifies).toEqual([])
    expect(c.tracks).toEqual([])
    expect(c.resets).toBe(0)
  })
})

describe('ConsoleAnalyticsClient', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => {
    infoSpy.mockRestore()
  })

  it('identify emite JSON estruturado', () => {
    new ConsoleAnalyticsClient().identify('u', { role: 'admin' })
    const payload = JSON.parse(infoSpy.mock.calls[0][0] as string)
    expect(payload.type).toBe('analytics_identify')
    expect(payload.userId).toBe('u')
    expect(payload.traits).toEqual({ role: 'admin' })
  })

  it('track emite JSON estruturado', () => {
    new ConsoleAnalyticsClient().track('evt', { value: 42 })
    const payload = JSON.parse(infoSpy.mock.calls[0][0] as string)
    expect(payload.event).toBe('evt')
    expect(payload.properties).toEqual({ value: 42 })
  })
})

describe('global helpers', () => {
  let original: ReturnType<typeof getAnalyticsClient>

  beforeEach(() => {
    original = getAnalyticsClient()
  })

  afterEach(() => {
    setAnalyticsClient(original)
  })

  it('setAnalyticsClient substitui o global', () => {
    const fake = new RecordingAnalyticsClient()
    setAnalyticsClient(fake)
    expect(getAnalyticsClient()).toBe(fake)
  })

  it('helpers identify / track / resetAnalytics delegam pro client atual', () => {
    const fake = new RecordingAnalyticsClient()
    setAnalyticsClient(fake)
    identify('alice', { role: 'admin' })
    track('signup', { source: 'organic' })
    resetAnalytics()
    expect(fake.identifies).toEqual([
      { userId: 'alice', traits: { role: 'admin' } },
    ])
    expect(fake.tracks).toEqual([
      { event: 'signup', properties: { source: 'organic' } },
    ])
    expect(fake.resets).toBe(1)
  })
})
