/**
 * Composer de WalletRepository — três modos:
 *
 *   1. Default (ambas as flags OFF): Redis only.
 *      Comportamento idêntico ao @/lib/wallet.ts legado.
 *
 *   2. USE_POSTGRES_WALLET_DUAL_WRITE=on, USE_POSTGRES_WALLET=off:
 *      Redis primary (lê), Postgres shadow (escreve em paralelo).
 *      Fase de bake-in pra detectar divergências.
 *
 *   3. USE_POSTGRES_WALLET=on:
 *      Postgres primary (lê), Redis shadow (segurança extra).
 *      Independe de DUAL_WRITE estar ligada — quando POSTGRES_WALLET
 *      está ON, dual-write fica implícito por segurança.
 *
 * **Importante:** Wallet é dinheiro. Nunca falhamos rápido pra Redis
 * sem antes ter dual-write ligado por dias e validado reconciliação.
 */

import { isFeatureEnabled, type FeatureFlagContext } from '@/lib/featureFlags'
import type { WalletRepository } from './ports/WalletRepository'
import { RedisWalletRepository } from './infra/RedisWalletRepository'
import { PostgresWalletRepository } from './infra/PostgresWalletRepository'
import { DualWriteWalletRepository } from './infra/DualWriteWalletRepository'

export function selectWalletRepo(
  context: FeatureFlagContext = {},
): WalletRepository {
  const usePostgres = isFeatureEnabled('USE_POSTGRES_WALLET', context)
  const dualWrite = isFeatureEnabled(
    'USE_POSTGRES_WALLET_DUAL_WRITE',
    context,
  )

  if (usePostgres) {
    // Postgres é primary; Redis fica como shadow pra segurança.
    return new DualWriteWalletRepository(
      new PostgresWalletRepository(),
      new RedisWalletRepository(),
    )
  }

  if (dualWrite) {
    // Redis primary (leitura), Postgres shadow (recebe escritas).
    return new DualWriteWalletRepository(
      new RedisWalletRepository(),
      new PostgresWalletRepository(),
    )
  }

  return new RedisWalletRepository()
}
