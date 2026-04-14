import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryPromptTemplateRepository,
  resolveSceneDirectorSystem,
  seedDefaultTemplates,
} from '@/modules/prompts'
import {
  getSceneDirectorSystem,
  SCENE_DIRECTOR_BASE,
  type ChainFromContext,
} from '@/lib/sceneDirectorSystem'

/**
 * TESTES DE PARIDADE — PR #3
 * ---------------------------
 * Invariante crítica: quando o DB está seedado com o conteúdo legado,
 * o caminho novo (resolveSceneDirectorSystem) deve produzir exatamente
 * o mesmo string que o caminho legado (getSceneDirectorSystem).
 *
 * Se algum teste aqui quebrar, significa que a flag USE_DB_PROMPTS NÃO
 * é mais transparente — e não deve ser promovida a ON global.
 */

const chainFrom: ChainFromContext = {
  sceneNumber: 1,
  sceneTitle: 'A descoberta',
  inheritedCharacters: ['abraao', 'abigail'],
  previousMoodId: 'warm',
  previousEmotion: 'curiosidade crescente',
  previousPromptTail: 'Abraão segura o objeto contra a luz do fim de tarde.',
}

describe('resolveSceneDirectorSystem — paridade com caminho legado', () => {
  let repo: InMemoryPromptTemplateRepository

  beforeEach(async () => {
    repo = new InMemoryPromptTemplateRepository()
    await seedDefaultTemplates({ repo, updatedBy: 'test' })
  })

  it('sem mood nem chain: DB == legado', async () => {
    const db = await resolveSceneDirectorSystem({ repo }, {})
    const legacy = getSceneDirectorSystem(undefined, null)
    expect(db.prompt).toBe(legacy)
    expect(db.source).toBe('db')
    expect(db.version).toBe(1)
  })

  it('com mood "warm": DB == legado', async () => {
    const db = await resolveSceneDirectorSystem({ repo }, { moodId: 'warm' })
    const legacy = getSceneDirectorSystem('warm', null)
    expect(db.prompt).toBe(legacy)
  })

  it('com mood "dramatic": DB == legado', async () => {
    const db = await resolveSceneDirectorSystem({ repo }, { moodId: 'dramatic' })
    const legacy = getSceneDirectorSystem('dramatic', null)
    expect(db.prompt).toBe(legacy)
  })

  it('com chainFrom e mesmo mood: DB == legado', async () => {
    const db = await resolveSceneDirectorSystem(
      { repo },
      { moodId: 'warm', chainFrom },
    )
    const legacy = getSceneDirectorSystem('warm', chainFrom)
    expect(db.prompt).toBe(legacy)
  })

  it('com chainFrom e mood diferente (transição): DB == legado', async () => {
    const db = await resolveSceneDirectorSystem(
      { repo },
      { moodId: 'dramatic', chainFrom },
    )
    const legacy = getSceneDirectorSystem('dramatic', chainFrom)
    expect(db.prompt).toBe(legacy)
  })
})

describe('resolveSceneDirectorSystem — fallback quando DB vazio', () => {
  it('sem seed: usa SCENE_DIRECTOR_BASE legado e reporta source=fallback', async () => {
    const repo = new InMemoryPromptTemplateRepository()
    const db = await resolveSceneDirectorSystem({ repo }, { moodId: 'warm' })
    const legacy = getSceneDirectorSystem('warm', null)
    expect(db.prompt).toBe(legacy)
    expect(db.source).toBe('fallback')
    expect(db.version).toBeUndefined()
  })
})

describe('resolveSceneDirectorSystem — workspace override', () => {
  it('usa override do workspace quando presente', async () => {
    const repo = new InMemoryPromptTemplateRepository()
    await seedDefaultTemplates({ repo, updatedBy: 'test' })

    // Um workspace customiza o base (ex.: universo diferente)
    const customBase = 'You are the Scene Director for "MY OWN UNIVERSE"...'
    await repo.upsert({
      slug: 'scene_director_base',
      kind: 'scene_director',
      content: customBase,
      version: 1,
      workspaceId: 'ws-custom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const db = await resolveSceneDirectorSystem(
      { repo },
      { workspaceId: 'ws-custom' },
    )

    expect(db.prompt.startsWith(customBase)).toBe(true)
    expect(db.prompt.includes('AAZ com Jesus')).toBe(false)
    expect(db.source).toBe('db')
  })

  it('workspace sem override cai no global', async () => {
    const repo = new InMemoryPromptTemplateRepository()
    await seedDefaultTemplates({ repo, updatedBy: 'test' })

    const db = await resolveSceneDirectorSystem(
      { repo },
      { workspaceId: 'ws-sem-override' },
    )

    expect(db.prompt.startsWith(SCENE_DIRECTOR_BASE)).toBe(true)
    expect(db.source).toBe('db')
  })
})
