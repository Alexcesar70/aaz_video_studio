import { describe, it, expect, beforeEach } from 'vitest'
import {
  createWorkspaceForUser,
  UserNotFoundError,
  UserAlreadyHasWorkspaceError,
  InvalidWorkspaceInputError,
  type CreateWorkspaceDeps,
} from '@/modules/workspaces'
import type { Organization } from '@/lib/organizations'
import type { PublicUser, User } from '@/lib/users'

/**
 * Fakes in-memory para testar o use case sem tocar em Redis.
 * Mantém apenas o que o use case efetivamente usa.
 */
function makeFakes(initial: { users?: User[] } = {}) {
  const userStore = new Map<string, User>()
  for (const u of initial.users ?? []) userStore.set(u.id, u)

  const orgStore: Organization[] = []

  const deps: CreateWorkspaceDeps = {
    getUser: async (id) => userStore.get(id) ?? null,

    createOrganization: async (params) => {
      const now = new Date().toISOString()
      const org: Organization = {
        id: params.id ?? `org-${orgStore.length + 1}`,
        slug: params.id ?? `org-${orgStore.length + 1}`,
        name: params.name,
        plan: params.plan,
        status: 'active',
        ownerId: params.ownerId,
        type: params.type,
        maxUsers: params.maxUsers,
        walletId: `wallet-${orgStore.length + 1}`,
        products: params.products,
        leaderCanCreate: params.leaderCanCreate ?? true,
        billingEmail: params.billingEmail,
        createdAt: now,
        updatedAt: now,
      }
      orgStore.push(org)
      return org
    },

    updateUser: async (id, patch) => {
      const current = userStore.get(id)
      if (!current) return null
      const updated: User = { ...current, ...patch }
      userStore.set(id, updated)
      // Returns PublicUser (omits passwordHash)
      const { passwordHash: _removed, ...publicUser } = updated
      void _removed
      return publicUser as PublicUser
    },

    resolveDefaultPlanId: async () => 'trial',
  }

  return { deps, userStore, orgStore }
}

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'u1@x.com',
    name: 'User One',
    role: 'creator',
    status: 'active',
    passwordHash: 'hash',
    createdAt: new Date().toISOString(),
    createdBy: 'system',
    ...overrides,
  }
}

describe('createWorkspaceForUser', () => {
  describe('fluxo feliz', () => {
    it('cria workspace individual (maxUsers=1) e vincula user', async () => {
      const { deps, userStore, orgStore } = makeFakes({
        users: [fakeUser()],
      })

      const result = await createWorkspaceForUser(deps, {
        userId: 'u1',
        input: { name: 'Meu Studio', type: 'individual' },
      })

      expect(result.workspace.name).toBe('Meu Studio')
      expect(result.workspace.type).toBe('individual')
      expect(result.workspace.maxUsers).toBe(1)
      expect(result.workspace.ownerId).toBe('u1')
      expect(result.user.organizationId).toBe(result.workspace.id)
      expect(userStore.get('u1')?.organizationId).toBe(result.workspace.id)
      expect(orgStore).toHaveLength(1)
    })

    it('cria workspace team com maxUsers default=5', async () => {
      const { deps } = makeFakes({ users: [fakeUser()] })

      const result = await createWorkspaceForUser(deps, {
        userId: 'u1',
        input: { name: 'Acme', type: 'team' },
      })

      expect(result.workspace.type).toBe('team')
      expect(result.workspace.maxUsers).toBe(5)
      expect(result.workspace.leaderCanCreate).toBe(true)
    })

    it('workspace inclui todos os products por padrão', async () => {
      const { deps } = makeFakes({ users: [fakeUser()] })
      const result = await createWorkspaceForUser(deps, {
        userId: 'u1',
        input: { name: 'XX', type: 'individual' },
      })
      expect(result.workspace.products).toEqual(['aaz_studio', 'courses', 'community'])
    })

    it('billingEmail default = email do user', async () => {
      const { deps } = makeFakes({
        users: [fakeUser({ email: 'alice@acme.com' })],
      })
      const result = await createWorkspaceForUser(deps, {
        userId: 'u1',
        input: { name: 'XX', type: 'individual' },
      })
      expect(result.workspace.billingEmail).toBe('alice@acme.com')
    })

    it('billingEmail explícito sobrescreve default', async () => {
      const { deps } = makeFakes({ users: [fakeUser()] })
      const result = await createWorkspaceForUser(deps, {
        userId: 'u1',
        input: { name: 'XX', type: 'individual', billingEmail: 'billing@co.com' },
      })
      expect(result.workspace.billingEmail).toBe('billing@co.com')
    })

    it('chama seedWalletCredits com walletId e planId quando fornecido', async () => {
      const { deps, orgStore } = makeFakes({ users: [fakeUser()] })
      const seeded: Array<{ walletId: string; planId: string }> = []
      deps.seedWalletCredits = async (walletId, planId) => {
        seeded.push({ walletId, planId })
      }

      await createWorkspaceForUser(deps, {
        userId: 'u1',
        input: { name: 'Seeded Studio', type: 'individual' },
      })

      expect(seeded).toHaveLength(1)
      expect(seeded[0].walletId).toBe(orgStore[0].walletId)
      expect(seeded[0].planId).toBe('trial')
    })

    it('não quebra se seedWalletCredits não for fornecido', async () => {
      const { deps } = makeFakes({ users: [fakeUser()] })
      // deps.seedWalletCredits é undefined por padrão

      const result = await createWorkspaceForUser(deps, {
        userId: 'u1',
        input: { name: 'No Seed', type: 'individual' },
      })

      expect(result.workspace).toBeDefined()
      expect(result.user.organizationId).toBe(result.workspace.id)
    })
  })

  describe('erros', () => {
    it('UserNotFoundError quando user não existe', async () => {
      const { deps } = makeFakes({ users: [] })
      await expect(
        createWorkspaceForUser(deps, {
          userId: 'ghost',
          input: { name: 'XX', type: 'individual' },
        }),
      ).rejects.toBeInstanceOf(UserNotFoundError)
    })

    it('UserAlreadyHasWorkspaceError quando user já tem organizationId', async () => {
      const { deps } = makeFakes({
        users: [fakeUser({ organizationId: 'existing-org' })],
      })
      await expect(
        createWorkspaceForUser(deps, {
          userId: 'u1',
          input: { name: 'XX', type: 'individual' },
        }),
      ).rejects.toBeInstanceOf(UserAlreadyHasWorkspaceError)
    })

    it('rejeita user revogado', async () => {
      const { deps } = makeFakes({
        users: [fakeUser({ status: 'revoked' })],
      })
      await expect(
        createWorkspaceForUser(deps, {
          userId: 'u1',
          input: { name: 'XX', type: 'individual' },
        }),
      ).rejects.toThrow(/revoked/)
    })

    it('propaga InvalidWorkspaceInputError do validator', async () => {
      const { deps } = makeFakes({ users: [fakeUser()] })
      await expect(
        createWorkspaceForUser(deps, {
          userId: 'u1',
          input: { name: '', type: 'individual' },
        }),
      ).rejects.toBeInstanceOf(InvalidWorkspaceInputError)
    })

    it('rejeita team com maxUsers<2', async () => {
      const { deps } = makeFakes({ users: [fakeUser()] })
      await expect(
        createWorkspaceForUser(deps, {
          userId: 'u1',
          input: { name: 'XX', type: 'team', maxUsers: 1 },
        }),
      ).rejects.toBeInstanceOf(InvalidWorkspaceInputError)
    })
  })
})
