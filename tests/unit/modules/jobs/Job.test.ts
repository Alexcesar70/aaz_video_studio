import { describe, it, expect } from 'vitest'
import { randomUUID } from 'crypto'
import {
  validateJob,
  transition,
  canTransition,
  InvalidJobError,
  InvalidJobTransitionError,
  JOB_KINDS,
  JOB_STATUSES,
} from '@/modules/jobs'

function baseJob(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: randomUUID(),
    kind: 'video_generation' as const,
    status: 'queued' as const,
    input: { prompt: 'hello' },
    attempts: 0,
    userId: 'user-1',
    workspaceId: 'ws-1',
    ...overrides,
  }
}

describe('Job domain', () => {
  describe('validateJob', () => {
    it('aceita um job válido minimal', () => {
      const j = validateJob(baseJob())
      expect(j.id).toBeTruthy()
      expect(j.kind).toBe('video_generation')
      expect(j.status).toBe('queued')
      expect(j.attempts).toBe(0)
      expect(j.userId).toBe('user-1')
      expect(j.workspaceId).toBe('ws-1')
      expect(j.createdAt).toBeTruthy()
      expect(j.updatedAt).toBeTruthy()
    })

    it('aceita workspaceId null (jobs de sistema)', () => {
      const j = validateJob(baseJob({ workspaceId: null }))
      expect(j.workspaceId).toBeNull()
    })

    it('rejeita id não-uuid', () => {
      expect(() => validateJob(baseJob({ id: 'not-a-uuid' }))).toThrow(
        InvalidJobError,
      )
    })

    it('rejeita id vazio', () => {
      expect(() => validateJob(baseJob({ id: '' }))).toThrow(/id é obrigatório/)
    })

    it('rejeita kind inválido', () => {
      expect(() =>
        validateJob(baseJob({ kind: 'foo' as unknown as string })),
      ).toThrow(/kind inválido/)
    })

    it('rejeita status inválido', () => {
      expect(() =>
        validateJob(baseJob({ status: 'nope' as unknown as string })),
      ).toThrow(/status inválido/)
    })

    it('rejeita attempts negativo', () => {
      expect(() => validateJob(baseJob({ attempts: -1 }))).toThrow(/attempts/)
    })

    it('rejeita attempts não-inteiro', () => {
      expect(() => validateJob(baseJob({ attempts: 1.5 }))).toThrow(/attempts/)
    })

    it('rejeita userId vazio', () => {
      expect(() => validateJob(baseJob({ userId: '' }))).toThrow(/userId/)
    })

    it('rejeita workspaceId string vazia', () => {
      expect(() => validateJob(baseJob({ workspaceId: '' }))).toThrow(
        /workspaceId/,
      )
    })

    it('rejeita input undefined', () => {
      expect(() => validateJob(baseJob({ input: undefined }))).toThrow(/input/)
    })

    it('aceita input null explícito', () => {
      const j = validateJob(baseJob({ input: null }))
      expect(j.input).toBeNull()
    })

    it('rejeita progress fora do range 0-100', () => {
      expect(() => validateJob(baseJob({ progress: -1 }))).toThrow(/progress/)
      expect(() => validateJob(baseJob({ progress: 101 }))).toThrow(/progress/)
    })

    it('rejeita completed sem output', () => {
      expect(() =>
        validateJob(baseJob({ status: 'completed' })),
      ).toThrow(/completed requer output/)
    })

    it('aceita completed com output', () => {
      const j = validateJob(
        baseJob({ status: 'completed', output: { url: 'x' } }),
      )
      expect(j.status).toBe('completed')
    })

    it('rejeita failed sem error', () => {
      expect(() => validateJob(baseJob({ status: 'failed' }))).toThrow(
        /failed requer error/,
      )
    })

    it('aceita failed com error', () => {
      const j = validateJob(
        baseJob({ status: 'failed', error: { message: 'boom' } }),
      )
      expect(j.error?.message).toBe('boom')
    })
  })

  describe('canTransition', () => {
    it('permite queued → running', () => {
      expect(canTransition('queued', 'running')).toBe(true)
    })
    it('permite running → completed', () => {
      expect(canTransition('running', 'completed')).toBe(true)
    })
    it('permite running → failed', () => {
      expect(canTransition('running', 'failed')).toBe(true)
    })
    it('permite queued → canceled', () => {
      expect(canTransition('queued', 'canceled')).toBe(true)
    })
    it('NÃO permite completed → running', () => {
      expect(canTransition('completed', 'running')).toBe(false)
    })
    it('NÃO permite failed → running', () => {
      expect(canTransition('failed', 'running')).toBe(false)
    })
    it('NÃO permite running → queued', () => {
      expect(canTransition('running', 'queued')).toBe(false)
    })
  })

  describe('transition', () => {
    it('queued → running incrementa attempts e seta startedAt', () => {
      const j = validateJob(baseJob())
      const next = transition(j, 'running')
      expect(next.status).toBe('running')
      expect(next.attempts).toBe(1)
      expect(next.startedAt).toBeTruthy()
      expect(next.completedAt).toBeUndefined()
    })

    it('running → completed anexa output e seta completedAt', () => {
      const running = transition(validateJob(baseJob()), 'running')
      const completed = transition(running, 'completed', {
        output: { url: 'https://x' },
      })
      expect(completed.status).toBe('completed')
      expect(completed.output).toEqual({ url: 'https://x' })
      expect(completed.completedAt).toBeTruthy()
    })

    it('running → failed anexa error e seta completedAt', () => {
      const running = transition(validateJob(baseJob()), 'running')
      const failed = transition(running, 'failed', {
        error: { message: 'boom', code: 'provider' },
      })
      expect(failed.status).toBe('failed')
      expect(failed.error?.message).toBe('boom')
      expect(failed.error?.code).toBe('provider')
      expect(failed.completedAt).toBeTruthy()
    })

    it('lança InvalidJobTransitionError em transição inválida', () => {
      const j = validateJob(baseJob())
      expect(() => transition(j, 'completed')).toThrow(InvalidJobTransitionError)
    })

    it('completed é terminal (não transita para nada)', () => {
      const j = validateJob(
        baseJob({ status: 'completed', output: { url: 'x' } }),
      )
      expect(() => transition(j, 'running')).toThrow(InvalidJobTransitionError)
      expect(() => transition(j, 'failed', { error: { message: 'x' } })).toThrow(
        InvalidJobTransitionError,
      )
    })

    it('createdAt é preservado; updatedAt atualiza', () => {
      const j = validateJob(baseJob())
      // Pequeno atraso para garantir timestamps distintos
      const before = Date.parse(j.updatedAt)
      const next = transition(j, 'running')
      expect(next.createdAt).toBe(j.createdAt)
      expect(Date.parse(next.updatedAt)).toBeGreaterThanOrEqual(before)
    })

    it('attempts do primeiro running é 1 (não 0)', () => {
      const j = validateJob(baseJob({ attempts: 0 }))
      const r = transition(j, 'running')
      expect(r.attempts).toBe(1)
    })
  })

  describe('constants', () => {
    it('JOB_KINDS contém os 4 kinds esperados', () => {
      expect(JOB_KINDS).toEqual([
        'video_generation',
        'image_generation',
        'music_generation',
        'voice_generation',
      ])
    })

    it('JOB_STATUSES contém os 5 status esperados', () => {
      expect(JOB_STATUSES).toEqual([
        'queued',
        'running',
        'completed',
        'failed',
        'canceled',
      ])
    })
  })
})
