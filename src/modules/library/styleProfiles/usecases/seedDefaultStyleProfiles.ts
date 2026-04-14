import { AAZ_STYLE_BLOCK } from '@/lib/imageDirectorSystem'
import type { StyleProfileRepository } from '../ports/StyleProfileRepository'
import { upsertStyleProfile } from './upsertStyleProfile'

/**
 * Popula o DB com os 6 presets oficiais de StyleProfile que todo
 * Creative Studio precisa ter. Todos são globais (workspaceId=null).
 *
 * IDEMPOTENTE. Rodar 2x com mesmo conteúdo é no-op.
 *
 * Presets:
 *   1. clay-massinha        → estilo AAZ (reusa AAZ_STYLE_BLOCK legado)
 *   2. 3d-stylized          → estilo 3D Pixar-like genérico
 *   3. anime                → 2D anime/manga
 *   4. cartoon-classic      → 2D cartoon clássico
 *   5. cinematic-realism    → 3D fotorealista
 *   6. motion-graphics      → 2.5D motion graphics
 *
 * O único preset importado do código legado é o clay-massinha — garante
 * paridade byte-a-byte com o comportamento atual do AAZ. Os outros 5 são
 * receitas novas escritas pensando em creators fora do universo AAZ.
 */

interface SeedEntry {
  slug: string
  name: string
  description: string
  promptBlock: string
  tags: string[]
}

function collectDefaults(): SeedEntry[] {
  return [
    {
      slug: 'clay-massinha',
      name: 'Clay / Massinha',
      description:
        '3D estilizado com textura de massinha, acabamento artesanal, paleta quente. Estilo original do AAZ com Jesus.',
      promptBlock: AAZ_STYLE_BLOCK,
      tags: ['3d', 'clay', 'stop-motion', 'childrens'],
    },
    {
      slug: '3d-stylized',
      name: '3D Stylized',
      description:
        '3D renderizado com proporções estilizadas, superfícies polidas e cores vibrantes. Sensibilidade Pixar/Illumination.',
      promptBlock:
        '3D rendered character/prop/environment with stylized proportions, smooth polished surfaces, vibrant saturated colors, cartoon-leaning forms, soft ambient lighting, subtle subsurface scattering on skin, cinematic depth of field. Clean shapes and expressive silhouettes. Pixar/Illumination animation look.',
      tags: ['3d', 'stylized', 'cinematic'],
    },
    {
      slug: 'anime',
      name: 'Anime / Manga',
      description:
        '2D anime/manga, cel-shading, olhos expressivos, linhas limpas. Sensibilidade japonesa.',
      promptBlock:
        '2D anime/manga aesthetic with cel-shaded forms, expressive large eyes, clean sharp linework, vibrant saturated colors with subtle gradients, dynamic posing, characteristic hair highlights, Japanese animation feel. Studio Ghibli warmth mixed with modern Kyoto Animation polish depending on mood.',
      tags: ['2d', 'anime', 'manga'],
    },
    {
      slug: 'cartoon-classic',
      name: 'Cartoon Classic',
      description:
        '2D cartoon clássico, linhas grossas, cores chapadas, proporções exageradas.',
      promptBlock:
        'Classic 2D cartoon aesthetic, bold black outlines, flat colors with simple cel shading, exaggerated proportions, high contrast, playful geometric shapes, hand-drawn feel. Disney/Cartoon Network sensibility — readable silhouettes, expressive faces, simplified anatomy.',
      tags: ['2d', 'cartoon', 'hand-drawn'],
    },
    {
      slug: 'cinematic-realism',
      name: 'Cinematic Realism',
      description:
        'Renderização 3D fotorealista, iluminação física, texturas detalhadas. Look de cinema.',
      promptBlock:
        'Photorealistic 3D render, realistic anatomy and proportions, detailed textures (fabric weave, skin pores, material imperfections), physically-based lighting with global illumination, shallow depth of field, cinematic color grading, film-like grain, anamorphic lens flares when appropriate. Weta/ILM level polish.',
      tags: ['3d', 'realism', 'cinematic', 'film'],
    },
    {
      slug: 'motion-graphics',
      name: 'Motion Graphics',
      description:
        '2.5D motion graphics com formas geométricas, cores chapadas e sensibilidade editorial.',
      promptBlock:
        '2.5D motion graphics aesthetic, geometric shapes, bold flat colors with subtle gradients, clean vector-style forms, parallax-friendly layered composition, kinetic typography sensibility, modern editorial/infographic feel. Clean surfaces without texture detail — forms carry the design. Think Giant Ant / Buck studios.',
      tags: ['2.5d', 'motion-graphics', 'vector', 'editorial'],
    },
  ]
}

export interface StyleProfileSeedResult {
  slug: string
  action: 'created' | 'updated' | 'unchanged'
  version: number
}

export async function seedDefaultStyleProfiles(deps: {
  repo: StyleProfileRepository
  updatedBy?: string
}): Promise<StyleProfileSeedResult[]> {
  const defaults = collectDefaults()
  const results: StyleProfileSeedResult[] = []

  for (const entry of defaults) {
    const { profile, action } = await upsertStyleProfile(
      { repo: deps.repo },
      {
        slug: entry.slug,
        name: entry.name,
        description: entry.description,
        promptBlock: entry.promptBlock,
        tags: entry.tags,
        workspaceId: null, // todos globais
        isOfficial: true,  // presets do sistema — não deletáveis
        updatedBy: deps.updatedBy,
      },
    )
    results.push({ slug: profile.slug, action, version: profile.version })
  }

  return results
}
