import { SCENE_DIRECTOR_BASE } from '@/lib/sceneDirectorSystem'
import {
  getLyricsDirectorSystem,
  getStoryboardDirectorSystem,
  getPromptGeneratorSystem,
} from '@/lib/lyricsDirectorSystem'
import type { PromptTemplateRepository } from '../ports/PromptTemplateRepository'
import type { PromptTemplateKind } from '../domain/PromptTemplate'
import { upsertPromptTemplate } from './upsertPromptTemplate'

/**
 * Seed dos system prompts atuais (hardcoded em src/lib/*DirectorSystem.ts)
 * como PromptTemplate globais no repositório.
 *
 * IDEMPOTENTE: rodar N vezes não duplica e só incrementa version se o
 * content mudou.
 *
 * O que NÃO seedamos aqui:
 *   - image_director: é altamente parameterizado (assetType + moodId). PR #3
 *     lida com ele especificamente, seedando o style_block isoladamente.
 *   - scene_director dynamic pieces (chain context, mood injection): essas
 *     camadas continuam em código — o template armazena só o BASE estático.
 *
 * Este arquivo é o único lugar que importa de src/lib/*DirectorSystem.ts.
 * Quando o PR #9 (consolidação) remover os arquivos legados, este seed
 * é removido junto.
 */

interface SeedEntry {
  slug: string
  kind: PromptTemplateKind
  content: string
  description: string
}

function collectDefaults(): SeedEntry[] {
  return [
    {
      slug: 'scene_director_base',
      kind: 'scene_director',
      content: SCENE_DIRECTOR_BASE,
      description:
        'Base do Scene Director (PT-BR + EN). Mood e chain context são aplicados dinamicamente em cima desta base.',
    },
    {
      slug: 'lyrics_director',
      kind: 'lyrics_director',
      content: getLyricsDirectorSystem(),
      description: 'Lyrics Director — gera letras de cantigas infantis cristãs.',
    },
    {
      slug: 'storyboard_director',
      kind: 'storyboard_director',
      content: getStoryboardDirectorSystem(),
      description:
        'Storyboard Director — divide letra da cantiga em cenas visuais (JSON, sem prompt em inglês).',
    },
    {
      slug: 'song_prompt_generator',
      kind: 'song_prompt_generator',
      content: getPromptGeneratorSystem(),
      description:
        'Song Prompt Generator — converte ação em português em prompt de vídeo em inglês para Seedance.',
    },
  ]
}

export interface SeedResult {
  slug: string
  action: 'created' | 'updated' | 'unchanged'
  version: number
}

export async function seedDefaultTemplates(deps: {
  repo: PromptTemplateRepository
  updatedBy?: string
}): Promise<SeedResult[]> {
  const defaults = collectDefaults()
  const results: SeedResult[] = []

  for (const entry of defaults) {
    const { template, action } = await upsertPromptTemplate(
      { repo: deps.repo },
      {
        slug: entry.slug,
        kind: entry.kind,
        content: entry.content,
        description: entry.description,
        workspaceId: null, // todos são globais
        updatedBy: deps.updatedBy,
      },
    )
    results.push({ slug: template.slug, action, version: template.version })
  }

  return results
}
