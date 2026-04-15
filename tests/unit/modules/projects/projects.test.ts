import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryProjectRepository,
  validateProject,
  getProject,
  getProjectOrThrow,
  listProjects,
  ProjectNotFoundError,
  InvalidProjectError,
} from '@/modules/projects'

describe('Project domain', () => {
  it('validateProject aceita minimal válido', () => {
    const p = validateProject({
      id: 'aaz-project',
      name: 'AAZ Project',
      workspaceId: 'ws-1',
      createdBy: 'alice',
    })
    expect(p.id).toBe('aaz-project')
    expect(p.memberIds).toEqual([])
  })

  it('rejeita id com caracteres inválidos', () => {
    expect(() =>
      validateProject({
        id: 'Bad ID',
        name: 'x',
        workspaceId: 'ws',
        createdBy: 'u',
      }),
    ).toThrow(InvalidProjectError)
  })

  it('rejeita workspaceId vazio', () => {
    expect(() =>
      validateProject({
        id: 'p',
        name: 'x',
        workspaceId: '',
        createdBy: 'u',
      }),
    ).toThrow(/workspaceId/)
  })

  it('trim no name', () => {
    const p = validateProject({
      id: 'p',
      name: '  Hello  ',
      workspaceId: 'ws',
      createdBy: 'u',
    })
    expect(p.name).toBe('Hello')
  })
})

describe('projects — use cases', () => {
  let repo: InMemoryProjectRepository
  beforeEach(() => {
    repo = new InMemoryProjectRepository()
  })

  async function seed(n: number, overrides: Partial<{ workspaceId: string; createdBy: string }> = {}) {
    for (let i = 0; i < n; i++) {
      await repo.upsert(
        validateProject({
          id: `p-${i}`,
          name: `Project ${i}`,
          workspaceId: overrides.workspaceId ?? 'ws-1',
          createdBy: overrides.createdBy ?? 'alice',
        }),
      )
    }
  }

  it('getProject retorna item persistido', async () => {
    await seed(1)
    expect((await getProject({ repo }, 'p-0'))?.name).toBe('Project 0')
  })

  it('getProjectOrThrow lança ProjectNotFoundError', async () => {
    await expect(
      getProjectOrThrow({ repo }, 'missing'),
    ).rejects.toThrow(ProjectNotFoundError)
  })

  it('listProjects filtra por workspaceId', async () => {
    await repo.upsert(
      validateProject({
        id: 'ws1-a',
        name: 'A',
        workspaceId: 'ws-1',
        createdBy: 'alice',
      }),
    )
    await repo.upsert(
      validateProject({
        id: 'ws1-b',
        name: 'B',
        workspaceId: 'ws-1',
        createdBy: 'alice',
      }),
    )
    await repo.upsert(
      validateProject({
        id: 'ws2-a',
        name: 'C',
        workspaceId: 'ws-2',
        createdBy: 'bob',
      }),
    )
    const ws1 = await listProjects({ repo }, { workspaceId: 'ws-1' })
    const ws2 = await listProjects({ repo }, { workspaceId: 'ws-2' })
    expect(ws1).toHaveLength(2)
    expect(ws2).toHaveLength(1)
  })

  it('listProjects filtra por memberId (contains)', async () => {
    await repo.upsert(
      validateProject({
        id: 'shared',
        name: 'Shared',
        workspaceId: 'ws-1',
        createdBy: 'alice',
        memberIds: ['bob', 'carol'],
      }),
    )
    await repo.upsert(
      validateProject({
        id: 'solo',
        name: 'Solo',
        workspaceId: 'ws-1',
        createdBy: 'alice',
      }),
    )
    const bobs = await listProjects({ repo }, { memberId: 'bob' })
    expect(bobs.map((p) => p.id)).toEqual(['shared'])
  })

  it('listProjects ordena desc por createdAt', async () => {
    await repo.upsert(
      validateProject({
        id: 'a',
        name: 'Old',
        workspaceId: 'ws-1',
        createdBy: 'u',
        createdAt: '2020-01-01T00:00:00Z',
      }),
    )
    await repo.upsert(
      validateProject({
        id: 'b',
        name: 'New',
        workspaceId: 'ws-1',
        createdBy: 'u',
        createdAt: '2025-01-01T00:00:00Z',
      }),
    )
    const list = await listProjects({ repo })
    expect(list[0].id).toBe('b')
  })

  it('respeita limit', async () => {
    await seed(5)
    const list = await listProjects({ repo }, { limit: 2 })
    expect(list).toHaveLength(2)
  })
})
