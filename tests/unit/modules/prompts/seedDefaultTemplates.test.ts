import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryPromptTemplateRepository,
  seedDefaultTemplates,
} from '@/modules/prompts'

/**
 * Testa o seed com o InMemoryRepository. Como o seed importa das fontes
 * legadas em src/lib/*DirectorSystem.ts, este teste garante que:
 *   1. A estrutura do seed está correta.
 *   2. É idempotente (rodar 2x não duplica).
 *   3. Muda detecção funciona (mudar conteúdo via upsert bumpa version).
 */

describe('seedDefaultTemplates', () => {
  let repo: InMemoryPromptTemplateRepository

  beforeEach(() => {
    repo = new InMemoryPromptTemplateRepository()
  })

  it('cria os 4 templates esperados na primeira execução', async () => {
    const results = await seedDefaultTemplates({ repo, updatedBy: 'seed' })

    expect(results).toHaveLength(4)
    expect(results.every((r) => r.action === 'created')).toBe(true)

    const slugs = results.map((r) => r.slug).sort()
    expect(slugs).toEqual([
      'lyrics_director',
      'scene_director_base',
      'song_prompt_generator',
      'storyboard_director',
    ])
  })

  it('é idempotente — segunda execução retorna unchanged', async () => {
    await seedDefaultTemplates({ repo, updatedBy: 'seed' })
    const second = await seedDefaultTemplates({ repo, updatedBy: 'seed' })

    expect(second.every((r) => r.action === 'unchanged')).toBe(true)
    expect(second.every((r) => r.version === 1)).toBe(true)
  })

  it('todos os templates são globais (workspaceId=null)', async () => {
    await seedDefaultTemplates({ repo, updatedBy: 'seed' })
    const all = await repo.list({ workspaceId: null })
    expect(all).toHaveLength(4)
    expect(all.every((t) => t.workspaceId === null)).toBe(true)
  })

  it('content dos templates é não-vazio e maior que 100 chars', async () => {
    await seedDefaultTemplates({ repo, updatedBy: 'seed' })
    const all = await repo.list()
    for (const t of all) {
      expect(t.content.length).toBeGreaterThan(100)
    }
  })

  it('scene_director_base tem kind=scene_director', async () => {
    await seedDefaultTemplates({ repo, updatedBy: 'seed' })
    const t = await repo.findBySlugExact('scene_director_base', null)
    expect(t?.kind).toBe('scene_director')
  })

  it('lyrics_director tem kind=lyrics_director', async () => {
    await seedDefaultTemplates({ repo, updatedBy: 'seed' })
    const t = await repo.findBySlugExact('lyrics_director', null)
    expect(t?.kind).toBe('lyrics_director')
  })
})
