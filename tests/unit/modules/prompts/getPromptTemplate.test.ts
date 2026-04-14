import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryPromptTemplateRepository,
  getPromptTemplate,
  upsertPromptTemplate,
} from '@/modules/prompts'

describe('getPromptTemplate use case', () => {
  let repo: InMemoryPromptTemplateRepository

  beforeEach(() => {
    repo = new InMemoryPromptTemplateRepository()
  })

  it('resolve global quando não há override de workspace', async () => {
    await upsertPromptTemplate(
      { repo },
      { slug: 'scene_director_base', kind: 'scene_director', content: 'G' },
    )
    const resolved = await getPromptTemplate(
      { repo },
      { slug: 'scene_director_base', workspaceId: 'ws-1' },
    )
    expect(resolved?.content).toBe('G')
  })

  it('resolve override quando workspace tem template próprio', async () => {
    await upsertPromptTemplate(
      { repo },
      { slug: 'scene_director_base', kind: 'scene_director', content: 'G' },
    )
    await upsertPromptTemplate(
      { repo },
      {
        slug: 'scene_director_base',
        kind: 'scene_director',
        content: 'W',
        workspaceId: 'ws-1',
      },
    )
    const resolved = await getPromptTemplate(
      { repo },
      { slug: 'scene_director_base', workspaceId: 'ws-1' },
    )
    expect(resolved?.content).toBe('W')
  })

  it('retorna null quando slug não existe em nenhum escopo', async () => {
    const resolved = await getPromptTemplate(
      { repo },
      { slug: 'nao_existe', workspaceId: 'ws-1' },
    )
    expect(resolved).toBeNull()
  })

  it('sem workspaceId, ignora overrides e busca só global', async () => {
    await upsertPromptTemplate(
      { repo },
      {
        slug: 'scene_director_base',
        kind: 'scene_director',
        content: 'W',
        workspaceId: 'ws-1',
      },
    )
    const resolved = await getPromptTemplate(
      { repo },
      { slug: 'scene_director_base' },
    )
    expect(resolved).toBeNull() // não existe global
  })
})
