/**
 * Composer — escolhe a implementação concreta de `UserRepository`
 * baseado em feature flag `USE_POSTGRES_USERS`.
 *
 * Pattern:
 *   import { selectUserRepo } from '@/modules/users/composer'
 *
 *   export async function GET(req: NextRequest) {
 *     const repo = selectUserRepo({ userId: authUser.id })
 *     const u = await getPublicUserById({ repo }, authUser.id)
 *     ...
 *   }
 *
 * Quando a flag está OFF (default), retorna RedisUserRepository —
 * comportamento idêntico ao código legado em @/lib/users.ts.
 *
 * Quando ON, retorna PostgresUserRepository. Falhas no Postgres
 * NÃO caem em fallback automático no Redis — forçamos o erro a
 * subir para que reportError capture e o canário possa ser
 * desligado rapidamente.
 *
 * `dualRead` (futuro): em fase de migração avançada, podemos
 * adicionar uma estratégia que lê ambos e compara — fora de escopo
 * para o primeiro PR de wiring.
 */

import { isFeatureEnabled, type FeatureFlagContext } from '@/lib/featureFlags'
import type { UserRepository } from './ports/UserRepository'
import { RedisUserRepository } from './infra/RedisUserRepository'
import { PostgresUserRepository } from './infra/PostgresUserRepository'

export function selectUserRepo(
  context: FeatureFlagContext = {},
): UserRepository {
  return isFeatureEnabled('USE_POSTGRES_USERS', context)
    ? new PostgresUserRepository()
    : new RedisUserRepository()
}
