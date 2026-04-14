import { describe, it, expect } from 'vitest'
import { isFeatureEnabled, resolveAllFlags } from '@/lib/featureFlags'

/**
 * Função auxiliar: constrói um env reader de um objeto literal.
 * Evita mexer em process.env durante os testes.
 */
function envFrom(vars: Record<string, string | undefined>) {
  return (key: string) => vars[key]
}

describe('isFeatureEnabled', () => {
  it('retorna false quando nenhuma env está setada (default off)', () => {
    const env = envFrom({})
    expect(isFeatureEnabled('USE_DB_PROMPTS', {}, env)).toBe(false)
  })

  it('respeita FF_{FLAG}=on como rollout global', () => {
    const env = envFrom({ FF_USE_DB_PROMPTS: 'on' })
    expect(isFeatureEnabled('USE_DB_PROMPTS', {}, env)).toBe(true)
  })

  it('respeita FF_{FLAG}=off como kill-switch mesmo com targeted user', () => {
    const env = envFrom({
      FF_USE_DB_PROMPTS: 'off',
      FF_USE_DB_PROMPTS_USERS: 'alice,bob',
    })
    expect(
      isFeatureEnabled('USE_DB_PROMPTS', { userId: 'alice' }, env),
    ).toBe(false)
  })

  it('liga flag para usuário específico via FF_{FLAG}_USERS', () => {
    const env = envFrom({ FF_USE_DB_PROMPTS_USERS: 'alice,bob' })
    expect(
      isFeatureEnabled('USE_DB_PROMPTS', { userId: 'alice' }, env),
    ).toBe(true)
    expect(
      isFeatureEnabled('USE_DB_PROMPTS', { userId: 'bob' }, env),
    ).toBe(true)
    expect(
      isFeatureEnabled('USE_DB_PROMPTS', { userId: 'carol' }, env),
    ).toBe(false)
  })

  it('ignora FF_{FLAG}_USERS quando context.userId ausente', () => {
    const env = envFrom({ FF_USE_DB_PROMPTS_USERS: 'alice' })
    expect(isFeatureEnabled('USE_DB_PROMPTS', {}, env)).toBe(false)
  })

  it('liga flag por workspace via FF_{FLAG}_WORKSPACES', () => {
    const env = envFrom({ FF_USE_DB_PROMPTS_WORKSPACES: 'ws-1,ws-2' })
    expect(
      isFeatureEnabled('USE_DB_PROMPTS', { workspaceId: 'ws-1' }, env),
    ).toBe(true)
    expect(
      isFeatureEnabled('USE_DB_PROMPTS', { workspaceId: 'ws-9' }, env),
    ).toBe(false)
  })

  it('normaliza valores (case-insensitive e trim)', () => {
    const env = envFrom({ FF_USE_DB_PROMPTS: '  ON  ' })
    expect(isFeatureEnabled('USE_DB_PROMPTS', {}, env)).toBe(true)
  })

  it('trata valor desconhecido como default off', () => {
    const env = envFrom({ FF_USE_DB_PROMPTS: 'maybe' })
    expect(isFeatureEnabled('USE_DB_PROMPTS', {}, env)).toBe(false)
  })
})

describe('resolveAllFlags', () => {
  it('retorna snapshot de todas as flags conhecidas', () => {
    const env = envFrom({
      FF_USE_DB_PROMPTS: 'on',
      FF_NEW_SIGNUP_WIZARD_USERS: 'alice',
    })
    const snap = resolveAllFlags({ userId: 'alice' }, env)

    expect(snap.USE_DB_PROMPTS).toBe(true)
    expect(snap.NEW_SIGNUP_WIZARD).toBe(true)
    expect(snap.USE_STYLE_PROFILES).toBe(false)
    expect(snap.PROMPT_PLAYBOOKS).toBe(false)
  })

  it('snapshot default é tudo false', () => {
    const snap = resolveAllFlags({}, envFrom({}))
    expect(Object.values(snap).every((v) => v === false)).toBe(true)
  })
})
