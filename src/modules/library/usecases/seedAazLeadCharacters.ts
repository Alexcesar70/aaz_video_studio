import { getRedis } from '@/lib/redis'
import { ASSET_PREFIX, type Asset } from '@/lib/assets'
import {
  AAZ_LEAD_CHARACTERS,
  AAZ_DEFAULT_ORG_ID,
} from '../seeds/aazLeadCharacters'

/**
 * Port mínimo de storage para o seed. Implementado nativamente pelo
 * cliente redis (métodos get/set), permitindo injeção em testes.
 */
export interface SeedRedisLike {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<unknown>
}

export interface SeedLeadsResult {
  id: string
  action: 'created' | 'updated' | 'skipped'
}

/**
 * Popula o Redis com os 7 AAZ_LEAD_CHARACTERS como `Asset` records
 * no organizationId='aaz-com-jesus'.
 *
 * IDEMPOTENTE:
 *   - Se um asset com o mesmo id já existe no tipo 'character', é no-op
 *     por default (`strategy: 'skip'`).
 *   - Com `strategy: 'update'`, sobrescreve preservando os imageUrls
 *     existentes (eles podem ter sido setados via POST /api/assets).
 *
 * Chave Redis: aaz:asset:character:{id} — mesmo layout das rotas existentes.
 *
 * Aceita `redis` injetado para testes. Em produção, resolve via getRedis().
 */
export async function seedAazLeadCharacters(params: {
  redis?: SeedRedisLike
  strategy?: 'skip' | 'update'
  organizationId?: string
  createdBy?: string
} = {}): Promise<SeedLeadsResult[]> {
  const strategy = params.strategy ?? 'skip'
  const orgId = params.organizationId ?? AAZ_DEFAULT_ORG_ID
  const redis = params.redis ?? (await getRedis())
  const now = new Date().toISOString()

  const results: SeedLeadsResult[] = []

  for (const lead of AAZ_LEAD_CHARACTERS) {
    const key = `${ASSET_PREFIX}character:${lead.id}`
    const existingRaw = await redis.get(key)

    if (existingRaw) {
      if (strategy === 'skip') {
        results.push({ id: lead.id, action: 'skipped' })
        continue
      }

      // strategy === 'update' — preserva imageUrls já setadas
      let existing: Asset | null = null
      try {
        existing = JSON.parse(existingRaw) as Asset
      } catch {
        existing = null
      }
      const merged: Asset = {
        ...lead,
        imageUrls: existing?.imageUrls?.length ? existing.imageUrls : lead.imageUrls,
        organizationId: orgId,
        createdBy: params.createdBy ?? existing?.createdBy,
        createdAt: existing?.createdAt ?? lead.createdAt,
        updatedAt: now,
      }
      await redis.set(key, JSON.stringify(merged))
      results.push({ id: lead.id, action: 'updated' })
      continue
    }

    // Novo
    const fresh: Asset = {
      ...lead,
      organizationId: orgId,
      createdBy: params.createdBy,
      createdAt: lead.createdAt,
      updatedAt: now,
    }
    await redis.set(key, JSON.stringify(fresh))
    results.push({ id: lead.id, action: 'created' })
  }

  return results
}
