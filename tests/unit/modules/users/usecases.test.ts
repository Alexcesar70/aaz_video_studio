import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryUserRepository,
  getUserById,
  getUserByEmail,
  getPublicUserById,
  getUserByIdOrThrow,
  listUsers,
  upsertUser,
  UserNotFoundError,
} from '@/modules/users'

describe('users — use cases', () => {
  let repo: InMemoryUserRepository

  beforeEach(() => {
    repo = new InMemoryUserRepository()
  })

  describe('upsertUser + getUserById', () => {
    it('cria e depois recupera', async () => {
      await upsertUser(
        { repo },
        {
          id: 'alice',
          email: 'alice@test.com',
          name: 'Alice',
          role: 'creator',
          passwordHash: 'hash',
        },
      )
      const u = await getUserById({ repo }, 'alice')
      expect(u?.email).toBe('alice@test.com')
      expect(u?.role).toBe('creator')
    })

    it('idempotência: atualizar mesmo id não duplica', async () => {
      await upsertUser(
        { repo },
        {
          id: 'alice',
          email: 'alice@test.com',
          name: 'Alice',
          role: 'creator',
          passwordHash: 'h',
        },
      )
      await upsertUser(
        { repo },
        {
          id: 'alice',
          email: 'alice@test.com',
          name: 'Alice v2',
          role: 'creator',
          passwordHash: 'h',
        },
      )
      const list = await listUsers({ repo })
      expect(list).toHaveLength(1)
      expect(list[0].name).toBe('Alice v2')
    })
  })

  describe('findByEmail', () => {
    it('retorna user por email (case-insensitive)', async () => {
      await upsertUser(
        { repo },
        {
          id: 'alice',
          email: 'alice@test.com',
          name: 'Alice',
          role: 'creator',
          passwordHash: 'h',
        },
      )
      expect(
        (await getUserByEmail({ repo }, 'ALICE@TEST.COM'))?.id,
      ).toBe('alice')
    })

    it('null quando não existe', async () => {
      expect(await getUserByEmail({ repo }, 'ghost@x')).toBeNull()
    })
  })

  describe('getPublicUserById', () => {
    it('omite passwordHash', async () => {
      await upsertUser(
        { repo },
        {
          id: 'alice',
          email: 'alice@test.com',
          name: 'Alice',
          role: 'creator',
          passwordHash: 'SECRET_HASH',
        },
      )
      const pub = await getPublicUserById({ repo }, 'alice')
      expect(pub).not.toBeNull()
      expect('passwordHash' in (pub as Record<string, unknown>)).toBe(false)
    })
  })

  describe('getUserByIdOrThrow', () => {
    it('lança UserNotFoundError quando ausente', async () => {
      await expect(
        getUserByIdOrThrow({ repo }, 'ghost'),
      ).rejects.toThrow(UserNotFoundError)
    })
  })

  describe('listUsers + filters', () => {
    beforeEach(async () => {
      await upsertUser(
        { repo },
        {
          id: 'alice',
          email: 'alice@x',
          name: 'Alice',
          role: 'admin',
          passwordHash: 'h',
          organizationId: 'ws-1',
        },
      )
      await upsertUser(
        { repo },
        {
          id: 'bob',
          email: 'bob@x',
          name: 'Bob',
          role: 'creator',
          passwordHash: 'h',
          organizationId: 'ws-1',
        },
      )
      await upsertUser(
        { repo },
        {
          id: 'carol',
          email: 'carol@x',
          name: 'Carol',
          role: 'creator',
          passwordHash: 'h',
          organizationId: 'ws-2',
        },
      )
      await upsertUser(
        { repo },
        {
          id: 'revoked',
          email: 'revoked@x',
          name: 'Revoked',
          role: 'creator',
          status: 'revoked',
          passwordHash: 'h',
          organizationId: 'ws-1',
        },
      )
    })

    it('filtra por workspace', async () => {
      const ws1 = await listUsers({ repo }, { organizationId: 'ws-1' })
      expect(ws1.map((u) => u.id).sort()).toEqual(
        ['alice', 'bob', 'revoked'].sort(),
      )
    })

    it('filtra por role', async () => {
      const admins = await listUsers({ repo }, { role: 'admin' })
      expect(admins).toHaveLength(1)
      expect(admins[0].id).toBe('alice')
    })

    it('filtra por status', async () => {
      const active = await listUsers({ repo }, { status: 'active' })
      const revoked = await listUsers({ repo }, { status: 'revoked' })
      expect(active.length).toBeGreaterThan(0)
      expect(active.every((u) => u.status === 'active')).toBe(true)
      expect(revoked).toHaveLength(1)
      expect(revoked[0].id).toBe('revoked')
    })

    it('filtra por organizationId null (sem workspace)', async () => {
      await upsertUser(
        { repo },
        {
          id: 'orphan',
          email: 'orphan@x',
          name: 'Orphan',
          role: 'creator',
          passwordHash: 'h',
          organizationId: null,
        },
      )
      const orphans = await listUsers({ repo }, { organizationId: null })
      expect(orphans).toHaveLength(1)
      expect(orphans[0].id).toBe('orphan')
    })

    it('respeita limit', async () => {
      const list = await listUsers({ repo }, { limit: 2 })
      expect(list).toHaveLength(2)
    })
  })

  describe('InMemoryUserRepository — regras específicas', () => {
    it('rejeita upsert de email que já pertence a outro id', async () => {
      await upsertUser(
        { repo },
        {
          id: 'alice',
          email: 'shared@x',
          name: 'A',
          role: 'creator',
          passwordHash: 'h',
        },
      )
      await expect(
        upsertUser(
          { repo },
          {
            id: 'bob',
            email: 'shared@x',
            name: 'B',
            role: 'creator',
            passwordHash: 'h',
          },
        ),
      ).rejects.toThrow(/já pertence/)
    })

    it('permite atualizar próprio user com novo email', async () => {
      await upsertUser(
        { repo },
        {
          id: 'alice',
          email: 'old@x',
          name: 'Alice',
          role: 'creator',
          passwordHash: 'h',
        },
      )
      await upsertUser(
        { repo },
        {
          id: 'alice',
          email: 'new@x',
          name: 'Alice',
          role: 'creator',
          passwordHash: 'h',
        },
      )
      expect((await getUserByEmail({ repo }, 'new@x'))?.id).toBe('alice')
      expect(await getUserByEmail({ repo }, 'old@x')).toBeNull()
    })

    it('touchLastActive atualiza timestamp', async () => {
      await upsertUser(
        { repo },
        {
          id: 'alice',
          email: 'a@x',
          name: 'A',
          role: 'creator',
          passwordHash: 'h',
        },
      )
      const before = await getUserById({ repo }, 'alice')
      expect(before?.lastActiveAt).toBeUndefined()

      const at = new Date('2025-06-01T12:00:00Z')
      await repo.touchLastActive('alice', at)

      const after = await getUserById({ repo }, 'alice')
      expect(after?.lastActiveAt).toBe('2025-06-01T12:00:00.000Z')
    })

    it('remove limpa ambos os indices (id + email)', async () => {
      await upsertUser(
        { repo },
        {
          id: 'alice',
          email: 'a@x',
          name: 'A',
          role: 'creator',
          passwordHash: 'h',
        },
      )
      await repo.remove('alice')
      expect(await getUserById({ repo }, 'alice')).toBeNull()
      expect(await getUserByEmail({ repo }, 'a@x')).toBeNull()
    })
  })
})
