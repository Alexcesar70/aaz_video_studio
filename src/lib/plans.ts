/**
 * Plan model — define os planos disponíveis para organizações.
 *
 * Cada plano determina limites (créditos mensais, número de usuários,
 * engines permitidas) e quais produtos estão incluídos.
 *
 * Redis keys:
 *  - aaz:plan:{id} → Plan JSON
 */

import { getRedis } from './redis'

export interface Plan {
  /** Identificador único do plano (slug) */
  id: string
  /** Nome legível (ex: "Standard", "Pro", "Premium", "Free Tier") */
  name: string
  /** Tipo de plano: individual, team, ou ambos */
  type: 'individual' | 'team' | 'both'
  /** Preço mensal em USD */
  priceMonthlyUsd: number
  /** Créditos incluídos por mês em USD */
  creditsMonthlyUsd: number
  /** Máximo de usuários permitidos (1 para planos individuais) */
  maxUsers: number
  /** IDs de engines permitidas. Array vazio = todas permitidas */
  engines: string[]
  /** Produtos incluídos no plano */
  products: string[]
  /** Se o plano está ativo (disponível para novas assinaturas) */
  isActive: boolean
  /** Se é elegível para trial gratuito */
  isFreeTrialEligible: boolean
  /** Data de criação ISO */
  createdAt: string
}

export const PLAN_PREFIX = 'aaz:plan:'

/**
 * Cria um novo plano. O id deve ser único.
 * @throws Se já existir um plano com o mesmo id.
 */
export async function createPlan(params: {
  id: string
  name: string
  type: Plan['type']
  priceMonthlyUsd: number
  creditsMonthlyUsd: number
  maxUsers: number
  engines?: string[]
  products?: string[]
  isActive?: boolean
  isFreeTrialEligible?: boolean
}): Promise<Plan> {
  const redis = await getRedis()
  const existing = await redis.get(`${PLAN_PREFIX}${params.id}`)
  if (existing) {
    throw new Error(`Plano com id "${params.id}" já existe.`)
  }

  const plan: Plan = {
    id: params.id,
    name: params.name,
    type: params.type,
    priceMonthlyUsd: params.priceMonthlyUsd,
    creditsMonthlyUsd: params.creditsMonthlyUsd,
    maxUsers: params.maxUsers,
    engines: params.engines ?? [],
    products: params.products ?? [],
    isActive: params.isActive ?? true,
    isFreeTrialEligible: params.isFreeTrialEligible ?? false,
    createdAt: new Date().toISOString(),
  }

  await redis.set(`${PLAN_PREFIX}${plan.id}`, JSON.stringify(plan))
  return plan
}

/**
 * Retorna um plano pelo id, ou null se não existir.
 */
export async function getPlanById(id: string): Promise<Plan | null> {
  const redis = await getRedis()
  const val = await redis.get(`${PLAN_PREFIX}${id}`)
  if (!val) return null
  try {
    return JSON.parse(val) as Plan
  } catch {
    return null
  }
}

/**
 * Lista todos os planos. Ordenados por nome.
 * @param onlyActive Se true, retorna apenas planos ativos.
 */
export async function listPlans(onlyActive = false): Promise<Plan[]> {
  const redis = await getRedis()
  const keys = await redis.keys(`${PLAN_PREFIX}*`)
  const plans: Plan[] = []

  for (const key of keys) {
    const val = await redis.get(key)
    if (val) {
      try {
        const plan = JSON.parse(val) as Plan
        if (!onlyActive || plan.isActive) {
          plans.push(plan)
        }
      } catch { /* skip malformed */ }
    }
  }

  plans.sort((a, b) => a.name.localeCompare(b.name))
  return plans
}

/**
 * Atualiza campos de um plano existente.
 * @returns O plano atualizado, ou null se não existir.
 */
export async function updatePlan(
  id: string,
  updates: Partial<Omit<Plan, 'id' | 'createdAt'>>
): Promise<Plan | null> {
  const current = await getPlanById(id)
  if (!current) return null

  const updated: Plan = {
    ...current,
    ...updates,
  }

  const redis = await getRedis()
  await redis.set(`${PLAN_PREFIX}${id}`, JSON.stringify(updated))
  return updated
}

/**
 * Deleta um plano definitivamente.
 * @returns true se existia e foi deletado, false se não existia.
 */
export async function deletePlan(id: string): Promise<boolean> {
  const existing = await getPlanById(id)
  if (!existing) return false
  const redis = await getRedis()
  await redis.del(`${PLAN_PREFIX}${id}`)
  return true
}
