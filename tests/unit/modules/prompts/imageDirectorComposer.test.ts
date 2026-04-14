import { describe, it, expect, beforeEach } from 'vitest'
import {
  InMemoryStyleProfileRepository,
  seedDefaultStyleProfiles,
} from '@/modules/library'
import {
  resolveImageDirectorSystem,
  buildImageDirectorSystem,
} from '@/modules/prompts'
import { AAZ_STYLE_BLOCK } from '@/lib/imageDirectorSystem'

describe('buildImageDirectorSystem (pure)', () => {
  const baseParams = {
    styleBlock: 'TEST STYLE BLOCK',
    assetType: 'character' as const,
  }

  it('inclui o styleBlock passado como parâmetro', () => {
    const out = buildImageDirectorSystem(baseParams)
    expect(out).toContain('TEST STYLE BLOCK')
  })

  it('usa guide de character quando assetType=character', () => {
    const out = buildImageDirectorSystem({ ...baseParams, assetType: 'character' })
    expect(out).toContain('For CHARACTERS:')
    expect(out).not.toContain('For SCENARIOS / ENVIRONMENTS:')
    expect(out).not.toContain('For ITEMS / PROPS:')
  })

  it('usa guide de scenario quando assetType=scenario', () => {
    const out = buildImageDirectorSystem({ ...baseParams, assetType: 'scenario' })
    expect(out).toContain('For SCENARIOS / ENVIRONMENTS:')
    expect(out).not.toContain('For CHARACTERS:')
  })

  it('usa guide de item quando assetType=item', () => {
    const out = buildImageDirectorSystem({ ...baseParams, assetType: 'item' })
    expect(out).toContain('For ITEMS / PROPS:')
  })

  it('inclui moodBlock quando mood tem injection', () => {
    const out = buildImageDirectorSystem({ ...baseParams, moodId: 'warm' })
    expect(out).toContain('MANDATORY MOOD / LIGHTING')
    expect(out).toContain('Cálido')
  })

  it('omite moodBlock quando mood é free (sem injection)', () => {
    const out = buildImageDirectorSystem({ ...baseParams, moodId: 'free' })
    expect(out).not.toContain('MANDATORY MOOD / LIGHTING')
  })

  it('inclui o nome do style profile quando informado', () => {
    const out = buildImageDirectorSystem({
      ...baseParams,
      styleProfileName: 'Clay / Massinha',
    })
    expect(out).toContain('Clay / Massinha')
  })

  it('não hardcoda "AAZ com Jesus" no cabeçalho (style-agnostic)', () => {
    const out = buildImageDirectorSystem(baseParams)
    expect(out).not.toContain('AAZ com Jesus')
  })

  it('guides são style-agnostic — não mencionam "clay" fora do styleBlock', () => {
    const out = buildImageDirectorSystem({
      ...baseParams,
      styleBlock: 'WATERCOLOR PAINTING', // styleBlock distinto, sem "clay"
    })
    // Se vier "clay" é só do moodBlock (sem clay) ou do styleBlock (que não tem).
    // Nenhum guide/rule deve mencionar clay literalmente.
    expect(out.toLowerCase()).not.toMatch(/\bclay\b/)
  })

  it('retorna JSON output instructions idênticas ao schema do legado', () => {
    const out = buildImageDirectorSystem(baseParams)
    expect(out).toContain('"prompt"')
    expect(out).toContain('"name_suggestion"')
    expect(out).toContain('"tags"')
  })
})

describe('resolveImageDirectorSystem', () => {
  let repo: InMemoryStyleProfileRepository

  beforeEach(async () => {
    repo = new InMemoryStyleProfileRepository()
    await seedDefaultStyleProfiles({ repo, updatedBy: 'test' })
  })

  it('resolve clay-massinha do DB e inclui AAZ_STYLE_BLOCK byte-a-byte', async () => {
    const resolved = await resolveImageDirectorSystem(
      { repo },
      { assetType: 'character' },
    )

    expect(resolved.source).toBe('db')
    expect(resolved.slug).toBe('clay-massinha')
    expect(resolved.version).toBe(1)
    expect(resolved.prompt).toContain(AAZ_STYLE_BLOCK)
  })

  it('quando DB vazio: usa AAZ_STYLE_BLOCK como fallback e reporta source=fallback', async () => {
    const emptyRepo = new InMemoryStyleProfileRepository()
    const resolved = await resolveImageDirectorSystem(
      { repo: emptyRepo },
      { assetType: 'character' },
    )

    expect(resolved.source).toBe('fallback')
    expect(resolved.prompt).toContain(AAZ_STYLE_BLOCK)
    expect(resolved.version).toBeUndefined()
  })

  it('respeita styleProfileSlug explícito do body', async () => {
    const resolved = await resolveImageDirectorSystem(
      { repo },
      { assetType: 'character', styleProfileSlug: 'anime' },
    )

    expect(resolved.slug).toBe('anime')
    expect(resolved.source).toBe('db')
    expect(resolved.prompt.toLowerCase()).toContain('anime')
  })

  it('workspace override sobrescreve preset global', async () => {
    const customBlock = 'Our Acme brand: flat editorial with electric blue'
    await repo.upsert({
      slug: 'clay-massinha',
      name: 'Acme Clay',
      promptBlock: customBlock,
      workspaceId: 'ws-acme',
      isOfficial: false,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const resolved = await resolveImageDirectorSystem(
      { repo },
      { assetType: 'character', workspaceId: 'ws-acme' },
    )

    expect(resolved.prompt).toContain(customBlock)
    expect(resolved.prompt).not.toContain(AAZ_STYLE_BLOCK)
  })

  it('workspace sem override cai no global', async () => {
    const resolved = await resolveImageDirectorSystem(
      { repo },
      { assetType: 'character', workspaceId: 'ws-other' },
    )
    expect(resolved.prompt).toContain(AAZ_STYLE_BLOCK)
    expect(resolved.source).toBe('db')
  })

  it('propaga mood no prompt resolvido', async () => {
    const resolved = await resolveImageDirectorSystem(
      { repo },
      { assetType: 'character', moodId: 'dramatic' },
    )
    expect(resolved.prompt).toContain('Dramático')
  })
})
