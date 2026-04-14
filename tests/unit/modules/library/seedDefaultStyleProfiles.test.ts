import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryStyleProfileRepository,
  seedDefaultStyleProfiles,
  getStyleProfile,
} from '@/modules/library'
import { AAZ_STYLE_BLOCK } from '@/lib/imageDirectorSystem'

describe('seedDefaultStyleProfiles', () => {
  let repo: InMemoryStyleProfileRepository

  beforeEach(() => {
    repo = new InMemoryStyleProfileRepository()
  })

  it('cria os 6 presets oficiais na primeira execução', async () => {
    const results = await seedDefaultStyleProfiles({ repo, updatedBy: 'test' })

    expect(results).toHaveLength(6)
    expect(results.every((r) => r.action === 'created')).toBe(true)

    const slugs = results.map((r) => r.slug).sort()
    expect(slugs).toEqual([
      '3d-stylized',
      'anime',
      'cartoon-classic',
      'cinematic-realism',
      'clay-massinha',
      'motion-graphics',
    ])
  })

  it('é idempotente — segunda execução retorna unchanged', async () => {
    await seedDefaultStyleProfiles({ repo, updatedBy: 'test' })
    const second = await seedDefaultStyleProfiles({ repo, updatedBy: 'test' })

    expect(second.every((r) => r.action === 'unchanged')).toBe(true)
    expect(second.every((r) => r.version === 1)).toBe(true)
  })

  it('todos os presets são globais (workspaceId=null) e oficiais', async () => {
    await seedDefaultStyleProfiles({ repo, updatedBy: 'test' })
    const all = await repo.list()

    expect(all).toHaveLength(6)
    expect(all.every((p) => p.workspaceId === null)).toBe(true)
    expect(all.every((p) => p.isOfficial === true)).toBe(true)
  })

  it('clay-massinha preserva o AAZ_STYLE_BLOCK legado byte-a-byte', async () => {
    await seedDefaultStyleProfiles({ repo, updatedBy: 'test' })
    const clay = await getStyleProfile({ repo }, { slug: 'clay-massinha' })

    expect(clay).not.toBeNull()
    expect(clay!.promptBlock).toBe(AAZ_STYLE_BLOCK)
  })

  it('cada preset tem promptBlock não-vazio (> 100 chars)', async () => {
    await seedDefaultStyleProfiles({ repo, updatedBy: 'test' })
    const all = await repo.list()
    for (const p of all) {
      expect(p.promptBlock.length).toBeGreaterThan(100)
    }
  })

  it('cada preset tem tags descritivas', async () => {
    await seedDefaultStyleProfiles({ repo, updatedBy: 'test' })
    const all = await repo.list()
    for (const p of all) {
      expect(p.tags?.length).toBeGreaterThan(0)
    }
  })

  it('atualização de conteúdo bumpa version', async () => {
    // Seed inicial: todos os 6 presets com version=1.
    await seedDefaultStyleProfiles({ repo, updatedBy: 'test' })
    const v1 = await getStyleProfile({ repo }, { slug: 'anime' })
    expect(v1?.version).toBe(1)

    // Simula usuário editando direto no Redis (repo.upsert NÃO bumpa —
    // preserva a version do objeto passado).
    const edited = { ...v1!, promptBlock: v1!.promptBlock + ' extra text' }
    await repo.upsert(edited)

    // Re-seed com o conteúdo original: usecase detecta diff e bumpa
    // via bumpStyleProfileVersion → version=2.
    const second = await seedDefaultStyleProfiles({ repo, updatedBy: 'test' })
    const animeResult = second.find((r) => r.slug === 'anime')
    expect(animeResult?.action).toBe('updated')
    expect(animeResult?.version).toBe(2)
  })
})

describe('upsertStyleProfile via seed e edits', () => {
  it('workspace pode fork do preset global e ambos coexistem', async () => {
    const repo = new InMemoryStyleProfileRepository()
    await seedDefaultStyleProfiles({ repo, updatedBy: 'test' })

    // ws-1 fork de clay-massinha
    await repo.upsert({
      slug: 'clay-massinha',
      name: 'Clay (custom)',
      promptBlock: 'Clay com paleta fria para marca X',
      workspaceId: 'ws-1',
      isOfficial: false,
      forkedFromId: 'clay-massinha',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const global = await getStyleProfile(
      { repo },
      { slug: 'clay-massinha', workspaceId: null },
    )
    const ws1 = await getStyleProfile(
      { repo },
      { slug: 'clay-massinha', workspaceId: 'ws-1' },
    )

    expect(global!.promptBlock).toContain('warm palette')
    expect(ws1!.promptBlock).toContain('paleta fria')
    expect(ws1!.forkedFromId).toBe('clay-massinha')
  })
})
