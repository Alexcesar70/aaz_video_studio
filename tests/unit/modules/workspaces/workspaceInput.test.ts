import { describe, it, expect } from 'vitest'
import {
  validateCreateWorkspaceInput,
  InvalidWorkspaceInputError,
} from '@/modules/workspaces'

describe('validateCreateWorkspaceInput', () => {
  it('aceita individual válido (fixa maxUsers=1)', () => {
    const v = validateCreateWorkspaceInput({ name: 'Meu Studio', type: 'individual' })
    expect(v.name).toBe('Meu Studio')
    expect(v.type).toBe('individual')
    expect(v.maxUsers).toBe(1)
  })

  it('individual ignora maxUsers passado no input (ADR-0003)', () => {
    const v = validateCreateWorkspaceInput({
      name: 'Meu Studio',
      type: 'individual',
      maxUsers: 10, // input inválido — ignora
    })
    expect(v.maxUsers).toBe(1)
  })

  it('team default 5 quando maxUsers não informado', () => {
    const v = validateCreateWorkspaceInput({ name: 'Acme', type: 'team' })
    expect(v.maxUsers).toBe(5)
  })

  it('team respeita maxUsers explícito', () => {
    const v = validateCreateWorkspaceInput({ name: 'Acme', type: 'team', maxUsers: 25 })
    expect(v.maxUsers).toBe(25)
  })

  it('team com maxUsers<2 é rejeitado', () => {
    expect(() =>
      validateCreateWorkspaceInput({ name: 'Acme', type: 'team', maxUsers: 1 }),
    ).toThrow(InvalidWorkspaceInputError)
  })

  it('team com maxUsers>500 é rejeitado', () => {
    expect(() =>
      validateCreateWorkspaceInput({ name: 'Acme', type: 'team', maxUsers: 501 }),
    ).toThrow(/500/)
  })

  it('trunca maxUsers fracionário (floor)', () => {
    const v = validateCreateWorkspaceInput({ name: 'Acme', type: 'team', maxUsers: 5.7 })
    expect(v.maxUsers).toBe(5)
  })

  it('rejeita name vazio', () => {
    expect(() =>
      validateCreateWorkspaceInput({ name: '   ', type: 'individual' }),
    ).toThrow(/name é obrigatório/)
  })

  it('rejeita name com 1 char', () => {
    expect(() =>
      validateCreateWorkspaceInput({ name: 'a', type: 'individual' }),
    ).toThrow(/2 chars/)
  })

  it('rejeita name acima de 80 chars', () => {
    expect(() =>
      validateCreateWorkspaceInput({
        name: 'x'.repeat(81),
        type: 'individual',
      }),
    ).toThrow(/80 chars/)
  })

  it('rejeita type inválido', () => {
    expect(() =>
      validateCreateWorkspaceInput({
        name: 'Nome Ok',
        type: 'solo' as unknown as 'individual',
      }),
    ).toThrow(/type inválido/)
  })

  it('normaliza espaço no nome', () => {
    const v = validateCreateWorkspaceInput({ name: '   Meu Studio   ', type: 'individual' })
    expect(v.name).toBe('Meu Studio')
  })
})
