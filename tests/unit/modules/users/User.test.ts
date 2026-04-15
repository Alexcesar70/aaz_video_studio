import { describe, it, expect } from 'vitest'
import {
  validateUser,
  toPublicUser,
  InvalidUserError,
  USER_ROLES,
  USER_STATUSES,
} from '@/modules/users'

function baseUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'alice',
    email: 'alice@test.com',
    name: 'Alice',
    role: 'creator' as const,
    status: 'active' as const,
    passwordHash: 'hash',
    ...overrides,
  }
}

describe('User domain', () => {
  describe('validateUser', () => {
    it('aceita um user válido minimal', () => {
      const u = validateUser(baseUser())
      expect(u.id).toBe('alice')
      expect(u.role).toBe('creator')
      expect(u.status).toBe('active')
      expect(u.assignedProjectIds).toEqual([])
      expect(u.permissions).toEqual([])
      expect(u.products).toEqual([])
      expect(u.organizationId).toBeNull()
      expect(u.createdBy).toBe('system')
    })

    it('normaliza email para lowercase trimmed', () => {
      const u = validateUser(baseUser({ email: '  Alice@Test.COM  ' }))
      expect(u.email).toBe('alice@test.com')
    })

    it('trim no name', () => {
      const u = validateUser(baseUser({ name: '  Alice  ' }))
      expect(u.name).toBe('Alice')
    })

    it('rejeita id vazio', () => {
      expect(() => validateUser(baseUser({ id: '' }))).toThrow(
        InvalidUserError,
      )
    })

    it('rejeita id com caracteres proibidos', () => {
      expect(() => validateUser(baseUser({ id: 'Alice Silva' }))).toThrow(
        /id inválido/,
      )
    })

    it('aceita id com hífen e underscore', () => {
      expect(() =>
        validateUser(baseUser({ id: 'user_alice-v2' })),
      ).not.toThrow()
    })

    it('rejeita email vazio', () => {
      expect(() => validateUser(baseUser({ email: '' }))).toThrow(/email/)
    })

    it('rejeita name vazio', () => {
      expect(() => validateUser(baseUser({ name: '  ' }))).toThrow(/name/)
    })

    it('rejeita role inválido', () => {
      expect(() =>
        validateUser(baseUser({ role: 'guest' as unknown as string })),
      ).toThrow(/role/)
    })

    it('rejeita status inválido', () => {
      expect(() =>
        validateUser(baseUser({ status: 'archived' as unknown as string })),
      ).toThrow(/status/)
    })

    it('rejeita passwordHash vazio', () => {
      expect(() => validateUser(baseUser({ passwordHash: '' }))).toThrow(
        /passwordHash/,
      )
    })

    it('rejeita monthlyBudgetUsd negativo', () => {
      expect(() =>
        validateUser(baseUser({ monthlyBudgetUsd: -10 })),
      ).toThrow(/monthlyBudget/)
    })

    it('rejeita organizationId string vazia', () => {
      expect(() =>
        validateUser(baseUser({ organizationId: '' })),
      ).toThrow(/organizationId/)
    })

    it('aceita organizationId null explícito', () => {
      const u = validateUser(baseUser({ organizationId: null }))
      expect(u.organizationId).toBeNull()
    })

    it('preserva arrays fornecidos', () => {
      const u = validateUser(
        baseUser({
          permissions: ['manage_users'],
          products: ['aaz_studio'],
          assignedProjectIds: ['p1', 'p2'],
        }),
      )
      expect(u.permissions).toEqual(['manage_users'])
      expect(u.products).toEqual(['aaz_studio'])
      expect(u.assignedProjectIds).toEqual(['p1', 'p2'])
    })
  })

  describe('toPublicUser', () => {
    it('omite passwordHash', () => {
      const u = validateUser(baseUser())
      const pub = toPublicUser(u)
      expect('passwordHash' in pub).toBe(false)
      expect(pub.id).toBe('alice')
    })
  })

  describe('constants', () => {
    it('USER_ROLES e USER_STATUSES expõem as unions', () => {
      expect(USER_ROLES).toEqual(['super_admin', 'admin', 'creator'])
      expect(USER_STATUSES).toEqual(['active', 'revoked'])
    })
  })
})
