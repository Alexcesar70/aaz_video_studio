/**
 * Feature Flag System
 * -------------------
 * Serve para destravar funcionalidades do refactor universal em produção
 * de forma controlada, mesmo sem ambiente de staging.
 *
 * Resolução (por ordem de precedência):
 *   1. Kill-switch global:   FF_{FLAG}=off      → sempre desligado
 *   2. Rollout targetado:    FF_{FLAG}_USERS=a,b → ligado só para users listados
 *   3. Rollout global:       FF_{FLAG}=on       → ligado para todos
 *   4. Default:              desligado
 *
 * Uso típico:
 *   if (isFeatureEnabled('USE_DB_PROMPTS', { userId: user.id })) {
 *     return await getPromptFromRepository(slug)
 *   }
 *   return LEGACY_HARDCODED_PROMPT
 *
 * Convenção: toda flag vive só enquanto a migração dura. Ao consolidar,
 * o caminho legado é removido e a flag some junto.
 */

export type FeatureFlag =
  | 'USE_DB_PROMPTS'          // PR #3 — directors leem do PromptTemplate
  | 'USE_DB_ONLY_CHARACTERS'  // PR #4 — /api/assets ignora LEAD_CHARACTERS const
  | 'USE_STYLE_PROFILES'      // PR #5 — StyleProfile como entidade
  | 'NEW_SIGNUP_WIZARD'       // PR #7 — wizard de workspace na primeira sessão
  | 'USE_ASYNC_GENERATION'    // M2-PR2 — /api/generate enfileira via Inngest
  | 'PROMPT_PLAYBOOKS'        // Fase 2 — Team Leader cria playbooks com Claude

export interface FeatureFlagContext {
  userId?: string
  workspaceId?: string
}

type EnvReader = (key: string) => string | undefined

const defaultEnvReader: EnvReader = (key) => process.env[key]

export function isFeatureEnabled(
  flag: FeatureFlag,
  context: FeatureFlagContext = {},
  env: EnvReader = defaultEnvReader,
): boolean {
  const global = env(`FF_${flag}`)?.trim().toLowerCase()

  if (global === 'off') return false
  if (global === 'on') return true

  if (context.userId) {
    const userList = env(`FF_${flag}_USERS`)
    if (userList) {
      const allowed = userList
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (allowed.includes(context.userId)) return true
    }
  }

  if (context.workspaceId) {
    const wsList = env(`FF_${flag}_WORKSPACES`)
    if (wsList) {
      const allowed = wsList
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (allowed.includes(context.workspaceId)) return true
    }
  }

  return false
}

/**
 * Snapshot de todas as flags ativas para um contexto.
 * Útil para expor em /api/auth/me ou injetar no JWT.
 */
export function resolveAllFlags(
  context: FeatureFlagContext = {},
  env: EnvReader = defaultEnvReader,
): Record<FeatureFlag, boolean> {
  const all: FeatureFlag[] = [
    'USE_DB_PROMPTS',
    'USE_DB_ONLY_CHARACTERS',
    'USE_STYLE_PROFILES',
    'NEW_SIGNUP_WIZARD',
    'USE_ASYNC_GENERATION',
    'PROMPT_PLAYBOOKS',
  ]
  return all.reduce(
    (acc, f) => ({ ...acc, [f]: isFeatureEnabled(f, context, env) }),
    {} as Record<FeatureFlag, boolean>,
  )
}
