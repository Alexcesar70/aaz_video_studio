import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryPromptTemplateRepository,
  upsertPromptTemplate,
} from '@/modules/prompts'

describe('upsertPromptTemplate use case', () => {
  let repo: InMemoryPromptTemplateRepository

  beforeEach(() => {
    repo = new InMemoryPromptTemplateRepository()
  })

  it('cria novo template com version=1 e action=created', async () => {
    const { template, action } = await upsertPromptTemplate(
      { repo },
      {
        slug: 'scene_director_base',
        kind: 'scene_director',
        content: 'v1',
      },
    )
    expect(action).toBe('created')
    expect(template.version).toBe(1)
    expect(template.content).toBe('v1')
    expect(template.workspaceId).toBeNull()
  })

  it('rodar 2x com mesmo content é no-op (action=unchanged)', async () => {
    await upsertPromptTemplate(
      { repo },
      { slug: 'scene_director_base', kind: 'scene_director', content: 'v1' },
    )
    const second = await upsertPromptTemplate(
      { repo },
      { slug: 'scene_director_base', kind: 'scene_director', content: 'v1' },
    )
    expect(second.action).toBe('unchanged')
    expect(second.template.version).toBe(1) // NÃO incrementa
  })

  it('atualiza content → incrementa version e action=updated', async () => {
    await upsertPromptTemplate(
      { repo },
      { slug: 'scene_director_base', kind: 'scene_director', content: 'v1' },
    )
    const second = await upsertPromptTemplate(
      { repo },
      { slug: 'scene_director_base', kind: 'scene_director', content: 'v2' },
    )
    expect(second.action).toBe('updated')
    expect(second.template.version).toBe(2)
    expect(second.template.content).toBe('v2')
  })

  it('atualiza description → action=updated (mesmo sem mudar content)', async () => {
    await upsertPromptTemplate(
      { repo },
      {
        slug: 'scene_director_base',
        kind: 'scene_director',
        content: 'v1',
        description: 'original',
      },
    )
    const second = await upsertPromptTemplate(
      { repo },
      {
        slug: 'scene_director_base',
        kind: 'scene_director',
        content: 'v1',
        description: 'atualizada',
      },
    )
    expect(second.action).toBe('updated')
    expect(second.template.version).toBe(2)
    expect(second.template.description).toBe('atualizada')
  })

  it('global e workspace override são independentes', async () => {
    await upsertPromptTemplate(
      { repo },
      { slug: 'scene_director_base', kind: 'scene_director', content: 'global' },
    )
    const wsOverride = await upsertPromptTemplate(
      { repo },
      {
        slug: 'scene_director_base',
        kind: 'scene_director',
        content: 'ws-content',
        workspaceId: 'ws-1',
      },
    )

    expect(wsOverride.action).toBe('created') // primeira vez neste escopo
    expect(wsOverride.template.version).toBe(1)

    const globals = await repo.list({ workspaceId: null })
    const overrides = await repo.list({ workspaceId: 'ws-1' })
    expect(globals[0].content).toBe('global')
    expect(overrides[0].content).toBe('ws-content')
  })

  it('popula createdBy na primeira criação e updatedBy nas atualizações', async () => {
    const first = await upsertPromptTemplate(
      { repo },
      {
        slug: 'scene_director_base',
        kind: 'scene_director',
        content: 'v1',
        updatedBy: 'alexandre',
      },
    )
    expect(first.template.createdBy).toBe('alexandre')
    expect(first.template.updatedBy).toBe('alexandre')

    const second = await upsertPromptTemplate(
      { repo },
      {
        slug: 'scene_director_base',
        kind: 'scene_director',
        content: 'v2',
        updatedBy: 'alice',
      },
    )
    expect(second.template.updatedBy).toBe('alice')
  })
})
