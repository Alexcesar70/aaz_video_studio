import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryPromptTemplateRepository,
  resolveLyricsDirectorSystem,
  resolveStoryboardDirectorSystem,
  resolveSongPromptGeneratorSystem,
  seedDefaultTemplates,
} from '@/modules/prompts'
import {
  getLyricsDirectorSystem,
  getStoryboardDirectorSystem,
  getPromptGeneratorSystem,
} from '@/lib/lyricsDirectorSystem'

/**
 * Paridade dos 3 resolvers da família Lyrics Director.
 */

describe('resolveLyricsDirectorSystem — paridade', () => {
  let repo: InMemoryPromptTemplateRepository

  beforeEach(async () => {
    repo = new InMemoryPromptTemplateRepository()
    await seedDefaultTemplates({ repo, updatedBy: 'test' })
  })

  it('lyrics: DB == legado', async () => {
    const db = await resolveLyricsDirectorSystem({ repo })
    expect(db.prompt).toBe(getLyricsDirectorSystem())
    expect(db.source).toBe('db')
  })

  it('storyboard: DB == legado', async () => {
    const db = await resolveStoryboardDirectorSystem({ repo })
    expect(db.prompt).toBe(getStoryboardDirectorSystem())
    expect(db.source).toBe('db')
  })

  it('song prompt generator: DB == legado', async () => {
    const db = await resolveSongPromptGeneratorSystem({ repo })
    expect(db.prompt).toBe(getPromptGeneratorSystem())
    expect(db.source).toBe('db')
  })
})

describe('resolveLyricsDirectorSystem — fallback', () => {
  it('sem seed, lyrics cai no legado com source=fallback', async () => {
    const repo = new InMemoryPromptTemplateRepository()
    const db = await resolveLyricsDirectorSystem({ repo })
    expect(db.prompt).toBe(getLyricsDirectorSystem())
    expect(db.source).toBe('fallback')
  })

  it('sem seed, storyboard cai no legado', async () => {
    const repo = new InMemoryPromptTemplateRepository()
    const db = await resolveStoryboardDirectorSystem({ repo })
    expect(db.prompt).toBe(getStoryboardDirectorSystem())
    expect(db.source).toBe('fallback')
  })

  it('sem seed, song prompt cai no legado', async () => {
    const repo = new InMemoryPromptTemplateRepository()
    const db = await resolveSongPromptGeneratorSystem({ repo })
    expect(db.prompt).toBe(getPromptGeneratorSystem())
    expect(db.source).toBe('fallback')
  })
})

describe('resolveLyricsDirectorSystem — workspace override', () => {
  it('usa override do workspace quando presente', async () => {
    const repo = new InMemoryPromptTemplateRepository()
    await seedDefaultTemplates({ repo, updatedBy: 'test' })

    const custom = 'Você é um compositor do universo X...'
    await repo.upsert({
      slug: 'lyrics_director',
      kind: 'lyrics_director',
      content: custom,
      version: 1,
      workspaceId: 'ws-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const db = await resolveLyricsDirectorSystem(
      { repo },
      { workspaceId: 'ws-1' },
    )

    expect(db.prompt).toBe(custom)
    expect(db.source).toBe('db')
  })
})
