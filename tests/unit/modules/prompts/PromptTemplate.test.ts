import { describe, it, expect } from 'vitest'
import {
  validatePromptTemplate,
  bumpVersion,
  InvalidPromptTemplateError,
  PROMPT_TEMPLATE_KINDS,
} from '@/modules/prompts'

function baseTemplate(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    slug: 'scene_director_base',
    kind: 'scene_director' as const,
    content: 'You are a scene director...',
    version: 1,
    workspaceId: null,
    ...overrides,
  }
}

describe('PromptTemplate domain', () => {
  describe('validatePromptTemplate', () => {
    it('aceita um template válido minimal', () => {
      const t = validatePromptTemplate(baseTemplate())
      expect(t.slug).toBe('scene_director_base')
      expect(t.kind).toBe('scene_director')
      expect(t.version).toBe(1)
      expect(t.workspaceId).toBeNull()
      expect(t.createdAt).toBeTruthy()
      expect(t.updatedAt).toBeTruthy()
    })

    it('rejeita slug vazio', () => {
      expect(() => validatePromptTemplate(baseTemplate({ slug: '' }))).toThrow(
        InvalidPromptTemplateError,
      )
    })

    it('rejeita slug com caracteres inválidos', () => {
      expect(() =>
        validatePromptTemplate(baseTemplate({ slug: 'Scene-Director' })),
      ).toThrow(/slug inválido/)
    })

    it('aceita slug com underscore e dígitos', () => {
      expect(() =>
        validatePromptTemplate(baseTemplate({ slug: 'director_v2' })),
      ).not.toThrow()
    })

    it('rejeita kind inválido', () => {
      expect(() =>
        validatePromptTemplate(
          baseTemplate({ kind: 'not_a_kind' as unknown as string }),
        ),
      ).toThrow(/kind inválido/)
    })

    it('rejeita content vazio', () => {
      expect(() =>
        validatePromptTemplate(baseTemplate({ content: '   ' })),
      ).toThrow(/content não pode ser vazio/)
    })

    it('rejeita content absurdamente grande (>100k)', () => {
      const huge = 'x'.repeat(100_001)
      expect(() =>
        validatePromptTemplate(baseTemplate({ content: huge })),
      ).toThrow(/excede 100k/)
    })

    it('rejeita version < 1', () => {
      expect(() =>
        validatePromptTemplate(baseTemplate({ version: 0 })),
      ).toThrow(/version/)
    })

    it('aceita workspaceId string', () => {
      const t = validatePromptTemplate(baseTemplate({ workspaceId: 'ws-123' }))
      expect(t.workspaceId).toBe('ws-123')
    })

    it('rejeita workspaceId string vazia', () => {
      expect(() =>
        validatePromptTemplate(baseTemplate({ workspaceId: '' })),
      ).toThrow(/workspaceId/)
    })
  })

  describe('bumpVersion', () => {
    it('incrementa version e mantém updatedAt >= createdAt ao mudar content', () => {
      const v1 = validatePromptTemplate(baseTemplate())
      const v2 = bumpVersion(v1, { content: 'New content' })
      expect(v2.version).toBe(2)
      expect(v2.content).toBe('New content')
      expect(v2.createdAt).toBe(v1.createdAt)
      // Invariante: updatedAt nunca é anterior a createdAt.
      // (Precisão de ms pode colidir em ticks rápidos — por isso >=.)
      expect(Date.parse(v2.updatedAt)).toBeGreaterThanOrEqual(
        Date.parse(v1.createdAt),
      )
    })

    it('preserva slug, kind e workspaceId', () => {
      const v1 = validatePromptTemplate(baseTemplate({ workspaceId: 'ws-1' }))
      const v2 = bumpVersion(v1, { content: 'x' })
      expect(v2.slug).toBe(v1.slug)
      expect(v2.kind).toBe(v1.kind)
      expect(v2.workspaceId).toBe('ws-1')
    })

    it('valida o resultado (conteudo vazio lança)', () => {
      const v1 = validatePromptTemplate(baseTemplate())
      expect(() => bumpVersion(v1, { content: '' })).toThrow(
        InvalidPromptTemplateError,
      )
    })
  })

  describe('PROMPT_TEMPLATE_KINDS', () => {
    it('contém os 6 kinds esperados', () => {
      expect(PROMPT_TEMPLATE_KINDS).toEqual([
        'scene_director',
        'image_director',
        'image_style_block',
        'lyrics_director',
        'storyboard_director',
        'song_prompt_generator',
      ])
    })
  })
})
