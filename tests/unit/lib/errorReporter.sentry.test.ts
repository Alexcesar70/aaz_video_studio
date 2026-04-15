import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Tests do adapter Sentry. Mockamos `@sentry/node` inteiro para
 * isolar — não queremos disparar requests reais nem precisar de DSN.
 */

const captureExceptionMock = vi.fn()
const captureMessageMock = vi.fn()
const initMock = vi.fn()
const setTagMock = vi.fn()
const setExtraMock = vi.fn()
const setFingerprintMock = vi.fn()

vi.mock('@sentry/node', () => {
  return {
    init: (cfg: unknown) => initMock(cfg),
    captureException: (err: unknown) => captureExceptionMock(err),
    captureMessage: (msg: unknown, sev: unknown) =>
      captureMessageMock(msg, sev),
    withScope: (cb: (scope: {
      setTag: (k: string, v: unknown) => void
      setExtra: (k: string, v: unknown) => void
      setFingerprint: (fp: unknown) => void
    }) => void) => {
      cb({
        setTag: (k, v) => setTagMock(k, v),
        setExtra: (k, v) => setExtraMock(k, v),
        setFingerprint: (fp) => setFingerprintMock(fp),
      })
    },
  }
})

import { createSentryReporter } from '@/lib/errorReporter.sentry'

beforeEach(() => {
  captureExceptionMock.mockClear()
  captureMessageMock.mockClear()
  initMock.mockClear()
  setTagMock.mockClear()
  setExtraMock.mockClear()
  setFingerprintMock.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createSentryReporter', () => {
  it('chama Sentry.init com a config recebida', () => {
    createSentryReporter({
      dsn: 'https://example@sentry/123',
      environment: 'test',
      release: 'abc123',
      tracesSampleRate: 0.5,
    })
    expect(initMock).toHaveBeenCalledTimes(1)
    const cfg = initMock.mock.calls[0][0] as Record<string, unknown>
    expect(cfg.dsn).toBe('https://example@sentry/123')
    expect(cfg.environment).toBe('test')
    expect(cfg.release).toBe('abc123')
    expect(cfg.tracesSampleRate).toBe(0.5)
  })

  it('default tracesSampleRate é 0.1', () => {
    createSentryReporter({ dsn: 'x' })
    const cfg = initMock.mock.calls[0][0] as Record<string, unknown>
    expect(cfg.tracesSampleRate).toBe(0.1)
  })
})

describe('Sentry reporter — reportError', () => {
  it('chama captureException quando recebe Error', () => {
    const reporter = createSentryReporter({ dsn: 'x' })
    const err = new Error('boom')
    reporter.reportError(err)
    expect(captureExceptionMock).toHaveBeenCalledWith(err)
  })

  it('chama captureMessage quando recebe valor não-Error', () => {
    const reporter = createSentryReporter({ dsn: 'x' })
    reporter.reportError('plain string')
    expect(captureMessageMock).toHaveBeenCalledWith('plain string', 'error')
    expect(captureExceptionMock).not.toHaveBeenCalled()
  })

  it('aplica tags, extra e fingerprint no scope', () => {
    const reporter = createSentryReporter({ dsn: 'x' })
    reporter.reportError(new Error('x'), {
      tags: { feature: 'video', userId: 'u1' },
      extra: { jobId: 'j-1' },
      fingerprint: ['video-gen', 'segmind-503'],
    })
    expect(setTagMock).toHaveBeenCalledWith('feature', 'video')
    expect(setTagMock).toHaveBeenCalledWith('userId', 'u1')
    expect(setExtraMock).toHaveBeenCalledWith('jobId', 'j-1')
    expect(setFingerprintMock).toHaveBeenCalledWith([
      'video-gen',
      'segmind-503',
    ])
  })

  it('descarta tags com valor undefined', () => {
    const reporter = createSentryReporter({ dsn: 'x' })
    reporter.reportError(new Error('x'), {
      tags: { feature: 'video', env: undefined },
    })
    expect(setTagMock).toHaveBeenCalledWith('feature', 'video')
    // env não deve ter sido setada
    const calls = setTagMock.mock.calls.map((c) => c[0])
    expect(calls).not.toContain('env')
  })
})

describe('Sentry reporter — reportMessage', () => {
  it('passa severity para captureMessage', () => {
    const reporter = createSentryReporter({ dsn: 'x' })
    reporter.reportMessage('hi', 'warning')
    expect(captureMessageMock).toHaveBeenCalledWith('hi', 'warning')
  })

  it('aplica context tags ao reportMessage', () => {
    const reporter = createSentryReporter({ dsn: 'x' })
    reporter.reportMessage('hi', 'info', { tags: { feature: 'auth' } })
    expect(setTagMock).toHaveBeenCalledWith('feature', 'auth')
  })
})
