import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryEpisodeRepository,
  validateEpisode,
  getEpisode,
  getEpisodeOrThrow,
  listEpisodes,
  EpisodeNotFoundError,
  InvalidEpisodeError,
  EPISODE_FINAL_STATUSES,
} from '@/modules/episodes'

function base(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ep-1',
    name: 'Episódio 1',
    workspaceId: 'ws-1',
    createdBy: 'alice',
    ...overrides,
  }
}

describe('Episode domain', () => {
  it('aceita projectId null (episódio avulso)', () => {
    const e = validateEpisode(base())
    expect(e.projectId).toBeNull()
    expect(e.finalStatus).toBe('none')
  })

  it('aceita projectId string', () => {
    const e = validateEpisode(base({ projectId: 'p-1' }))
    expect(e.projectId).toBe('p-1')
  })

  it('rejeita projectId string vazia', () => {
    expect(() => validateEpisode(base({ projectId: '' }))).toThrow(
      /projectId/,
    )
  })

  it('rejeita finalStatus inválido', () => {
    expect(() =>
      validateEpisode(base({ finalStatus: 'maybe' as unknown as string })),
    ).toThrow(/finalStatus/)
  })

  it('rejeita finalVideoSizeMb negativo', () => {
    expect(() =>
      validateEpisode(base({ finalVideoSizeMb: -1 })),
    ).toThrow(/finalVideoSizeMb/)
  })

  it('EPISODE_FINAL_STATUSES expõe as 4 opções', () => {
    expect(EPISODE_FINAL_STATUSES).toEqual([
      'none',
      'pending_review',
      'approved',
      'needs_changes',
    ])
  })
})

describe('episodes — use cases', () => {
  let repo: InMemoryEpisodeRepository
  beforeEach(() => {
    repo = new InMemoryEpisodeRepository()
  })

  it('getEpisode retorna episódio', async () => {
    await repo.upsert(validateEpisode(base()))
    expect((await getEpisode({ repo }, 'ep-1'))?.name).toBe('Episódio 1')
  })

  it('getEpisodeOrThrow lança', async () => {
    await expect(getEpisodeOrThrow({ repo }, 'x')).rejects.toThrow(
      EpisodeNotFoundError,
    )
  })

  it('listEpisodes filtra por projectId null (avulsos)', async () => {
    await repo.upsert(validateEpisode(base({ id: 'solo', projectId: null })))
    await repo.upsert(validateEpisode(base({ id: 'in-project', projectId: 'p-1' })))
    const solo = await listEpisodes({ repo }, { projectId: null })
    expect(solo).toHaveLength(1)
    expect(solo[0].id).toBe('solo')
  })

  it('listEpisodes filtra por projectId=string', async () => {
    await repo.upsert(validateEpisode(base({ id: 'a', projectId: 'p-1' })))
    await repo.upsert(validateEpisode(base({ id: 'b', projectId: 'p-2' })))
    const p1 = await listEpisodes({ repo }, { projectId: 'p-1' })
    expect(p1).toHaveLength(1)
    expect(p1[0].id).toBe('a')
  })

  it('listEpisodes filtra por finalStatus', async () => {
    await repo.upsert(validateEpisode(base({ id: 'a' })))
    await repo.upsert(
      validateEpisode(base({ id: 'b', finalStatus: 'approved' })),
    )
    const approved = await listEpisodes({ repo }, { finalStatus: 'approved' })
    expect(approved).toHaveLength(1)
  })

  it('listEpisodes filtra por createdBy', async () => {
    await repo.upsert(validateEpisode(base({ id: 'a', createdBy: 'alice' })))
    await repo.upsert(validateEpisode(base({ id: 'b', createdBy: 'bob' })))
    const alices = await listEpisodes({ repo }, { createdBy: 'alice' })
    expect(alices).toHaveLength(1)
  })

  it('listEpisodes ordena desc por createdAt', async () => {
    await repo.upsert(
      validateEpisode(
        base({ id: 'old', createdAt: '2020-01-01T00:00:00Z' }),
      ),
    )
    await repo.upsert(
      validateEpisode(
        base({ id: 'new', createdAt: '2025-01-01T00:00:00Z' }),
      ),
    )
    const list = await listEpisodes({ repo })
    expect(list[0].id).toBe('new')
  })
})
