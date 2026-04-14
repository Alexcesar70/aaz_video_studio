import {
  getLyricsDirectorSystem,
  getStoryboardDirectorSystem,
  getPromptGeneratorSystem,
} from '@/lib/lyricsDirectorSystem'
import type { PromptTemplateKind } from '../domain/PromptTemplate'
import type { PromptTemplateRepository } from '../ports/PromptTemplateRepository'
import { getPromptTemplate } from '../usecases/getPromptTemplate'

/**
 * Resolvers dos 3 system prompts da família Lyrics Director.
 *
 * Diferente do Scene Director, estes 3 são STATIC (sem mood/chain). A
 * "composição" é apenas: se DB tem, usa DB; senão, fallback pro legado.
 */

export interface ResolvedLyricsSystem {
  prompt: string
  source: 'db' | 'fallback'
  version?: number
  slug: string
  kind: PromptTemplateKind
}

async function resolveStatic(
  deps: { repo: PromptTemplateRepository },
  params: {
    slug: string
    kind: PromptTemplateKind
    fallbackLegacyFn: () => string
    workspaceId?: string | null
  },
): Promise<ResolvedLyricsSystem> {
  const template = await getPromptTemplate(deps, {
    slug: params.slug,
    workspaceId: params.workspaceId,
  })
  const prompt = template?.content ?? params.fallbackLegacyFn()
  return {
    prompt,
    source: template ? 'db' : 'fallback',
    version: template?.version,
    slug: params.slug,
    kind: params.kind,
  }
}

export function resolveLyricsDirectorSystem(
  deps: { repo: PromptTemplateRepository },
  params: { workspaceId?: string | null } = {},
): Promise<ResolvedLyricsSystem> {
  return resolveStatic(deps, {
    slug: 'lyrics_director',
    kind: 'lyrics_director',
    fallbackLegacyFn: getLyricsDirectorSystem,
    workspaceId: params.workspaceId,
  })
}

export function resolveStoryboardDirectorSystem(
  deps: { repo: PromptTemplateRepository },
  params: { workspaceId?: string | null } = {},
): Promise<ResolvedLyricsSystem> {
  return resolveStatic(deps, {
    slug: 'storyboard_director',
    kind: 'storyboard_director',
    fallbackLegacyFn: getStoryboardDirectorSystem,
    workspaceId: params.workspaceId,
  })
}

export function resolveSongPromptGeneratorSystem(
  deps: { repo: PromptTemplateRepository },
  params: { workspaceId?: string | null } = {},
): Promise<ResolvedLyricsSystem> {
  return resolveStatic(deps, {
    slug: 'song_prompt_generator',
    kind: 'song_prompt_generator',
    fallbackLegacyFn: getPromptGeneratorSystem,
    workspaceId: params.workspaceId,
  })
}
