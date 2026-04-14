import {
  composeSceneDirectorSystem,
  SCENE_DIRECTOR_BASE,
  type ChainFromContext,
} from '@/lib/sceneDirectorSystem'
import type { PromptTemplateRepository } from '../ports/PromptTemplateRepository'
import { getPromptTemplate } from '../usecases/getPromptTemplate'

/**
 * Resultado da resolução do system prompt do Scene Director.
 *
 * source:
 *   - 'db'       → template encontrado no repositório (workspace override ou global)
 *   - 'fallback' → DB não tinha template → usa SCENE_DIRECTOR_BASE legado
 *
 * O `source` é exposto pra telemetria (permite detectar no log se alguém
 * ligou a flag USE_DB_PROMPTS mas esqueceu de rodar o seed).
 */
export interface ResolvedSceneDirectorSystem {
  prompt: string
  source: 'db' | 'fallback'
  version?: number
  slug: string
}

const SCENE_DIRECTOR_SLUG = 'scene_director_base'

/**
 * Resolve o system prompt do Scene Director com precedência:
 *   1. PromptTemplate override do workspace (se houver)
 *   2. PromptTemplate global (se houver)
 *   3. SCENE_DIRECTOR_BASE legado (fallback seguro)
 *
 * Em qualquer um dos 3 casos, aplica a MESMA composição de mood + chainFrom
 * — garantindo paridade byte-a-byte com o caminho legado quando o DB está
 * seedado com o mesmo conteúdo.
 */
export async function resolveSceneDirectorSystem(
  deps: { repo: PromptTemplateRepository },
  params: {
    moodId?: string
    chainFrom?: ChainFromContext | null
    workspaceId?: string | null
  },
): Promise<ResolvedSceneDirectorSystem> {
  const template = await getPromptTemplate(deps, {
    slug: SCENE_DIRECTOR_SLUG,
    workspaceId: params.workspaceId,
  })

  const base = template?.content ?? SCENE_DIRECTOR_BASE
  const source: 'db' | 'fallback' = template ? 'db' : 'fallback'

  const prompt = composeSceneDirectorSystem(
    base,
    params.moodId,
    params.chainFrom ?? null,
  )

  return {
    prompt,
    source,
    version: template?.version,
    slug: SCENE_DIRECTOR_SLUG,
  }
}
