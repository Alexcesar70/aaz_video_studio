import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ConsoleErrorReporter,
  NoopErrorReporter,
  RecordingErrorReporter,
  setReporter,
  getReporter,
  reportError,
  reportMessage,
} from '@/lib/errorReporter'

describe('ConsoleErrorReporter', () => {
  let errSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    errSpy.mockRestore()
    warnSpy.mockRestore()
    logSpy.mockRestore()
  })

  it('reportError emite JSON estruturado em console.error', () => {
    const r = new ConsoleErrorReporter()
    r.reportError(new Error('boom'), {
      tags: { feature: 'video' },
      extra: { jobId: 'j-1' },
    })
    expect(errSpy).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(errSpy.mock.calls[0][0] as string)
    expect(payload.type).toBe('error_report')
    expect(payload.message).toBe('boom')
    expect(payload.errorName).toBe('Error')
    expect(payload.stack).toBeTruthy()
    expect(payload.tags).toEqual({ feature: 'video' })
    expect(payload.extra).toEqual({ jobId: 'j-1' })
    expect(payload.ts).toBeTruthy()
  })

  it('reportError funciona com valores não-Error', () => {
    const r = new ConsoleErrorReporter()
    r.reportError('string error')
    const payload = JSON.parse(errSpy.mock.calls[0][0] as string)
    expect(payload.message).toBe('string error')
    expect(payload.errorName).toBeUndefined()
  })

  it('reportMessage severity=error vai pro console.error', () => {
    const r = new ConsoleErrorReporter()
    r.reportMessage('msg', 'error')
    expect(errSpy).toHaveBeenCalled()
  })

  it('reportMessage severity=warning vai pro console.warn', () => {
    const r = new ConsoleErrorReporter()
    r.reportMessage('warn msg', 'warning')
    expect(warnSpy).toHaveBeenCalled()
  })

  it('reportMessage severity=info vai pro console.log', () => {
    const r = new ConsoleErrorReporter()
    r.reportMessage('info msg', 'info')
    expect(logSpy).toHaveBeenCalled()
  })

  it('compactTags descarta valores undefined', () => {
    const r = new ConsoleErrorReporter()
    r.reportError(new Error('x'), {
      tags: { feature: 'v', env: undefined, userId: 'u' },
    })
    const payload = JSON.parse(errSpy.mock.calls[0][0] as string)
    expect(payload.tags).toEqual({ feature: 'v', userId: 'u' })
    expect('env' in payload.tags).toBe(false)
  })

  it('preserva fingerprint quando fornecido', () => {
    const r = new ConsoleErrorReporter()
    r.reportError(new Error('x'), { fingerprint: ['group-a', 'v1'] })
    const payload = JSON.parse(errSpy.mock.calls[0][0] as string)
    expect(payload.fingerprint).toEqual(['group-a', 'v1'])
  })
})

describe('NoopErrorReporter', () => {
  it('reportError não faz nada', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = new NoopErrorReporter()
    r.reportError(new Error('x'))
    expect(errSpy).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })
})

describe('RecordingErrorReporter', () => {
  it('grava erros em errorCalls', () => {
    const r = new RecordingErrorReporter()
    const err = new Error('boom')
    r.reportError(err, { tags: { feature: 'x' } })
    expect(r.errorCalls).toHaveLength(1)
    expect(r.errorCalls[0].err).toBe(err)
    expect(r.errorCalls[0].context?.tags).toEqual({ feature: 'x' })
  })

  it('grava mensagens em messageCalls', () => {
    const r = new RecordingErrorReporter()
    r.reportMessage('hello', 'info')
    expect(r.messageCalls).toEqual([
      { message: 'hello', severity: 'info', context: undefined },
    ])
  })

  it('reset limpa ambos os arrays', () => {
    const r = new RecordingErrorReporter()
    r.reportError(new Error('x'))
    r.reportMessage('m', 'info')
    r.reset()
    expect(r.errorCalls).toEqual([])
    expect(r.messageCalls).toEqual([])
  })
})

describe('setReporter / getReporter / helpers globais', () => {
  let original: ReturnType<typeof getReporter>

  beforeEach(() => {
    original = getReporter()
  })

  afterEach(() => {
    setReporter(original)
  })

  it('setReporter substitui o reporter corrente', () => {
    const fake = new RecordingErrorReporter()
    setReporter(fake)
    expect(getReporter()).toBe(fake)
  })

  it('reportError helper delega para o reporter corrente', () => {
    const fake = new RecordingErrorReporter()
    setReporter(fake)
    reportError(new Error('boom'), { tags: { feature: 'video' } })
    expect(fake.errorCalls).toHaveLength(1)
    expect((fake.errorCalls[0].err as Error).message).toBe('boom')
  })

  it('reportMessage helper delega para o reporter corrente', () => {
    const fake = new RecordingErrorReporter()
    setReporter(fake)
    reportMessage('hi', 'warning', { extra: { k: 1 } })
    expect(fake.messageCalls).toHaveLength(1)
    expect(fake.messageCalls[0].message).toBe('hi')
    expect(fake.messageCalls[0].severity).toBe('warning')
    expect(fake.messageCalls[0].context?.extra).toEqual({ k: 1 })
  })
})
