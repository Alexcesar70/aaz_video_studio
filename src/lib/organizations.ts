/**
 * Modelo de organizações (Organizations) do AAZ Platform.
 *
 * Cada organização agrupa usuários sob um plano, com wallet própria
 * e acesso a um conjunto de produtos. Pode ser individual (1 user)
 * ou team (N users).
 *
 * Redis keys:
 *  - aaz:org:{id}          → Organization JSON
 *  - aaz:org_slug:{slug}   → id (índice secundário por slug)
 */

import { getRedis } from './redis'
import { createWallet } from './wallet'
import { createPlan, getPlanById, listPlans } from './plans'

// ── Types ────────────────────────────────────────────────────────

export type OrgStatus = 'active' | 'suspended' | 'cancelled'
export type OrgType = 'individual' | 'team'

export interface Organization {
  /** Identificador único (slug derivado do nome) */
  id: string
  /** Nome legível da organização */
  name: string
  /** Slug URL-friendly (pode diferir do id se houve colisão) */
  slug: string
  /** ID do plano associado */
  plan: string
  /** Status da organização */
  status: OrgStatus
  /** ID do usuário proprietário/líder */
  ownerId: string
  /** Tipo: individual (1 user) ou team (N users) */
  type: OrgType
  /** Máximo de usuários permitidos (1 para individual, N para teams) */
  maxUsers: number
  /** ID da wallet da organização */
  walletId: string
  /** Produtos habilitados para esta organização */
  products: string[]
  /** Se o líder também cria conteúdo (além de administrar) */
  leaderCanCreate: boolean
  /** Email para cobrança */
  billingEmail: string
  /** Data de criação ISO */
  createdAt: string
  /** Data da última atualização ISO */
  updatedAt: string
}

// ── Constants ────────────────────────────────────────────────────

export const ORG_PREFIX = 'aaz:org:'
export const ORG_SLUG_INDEX = 'aaz:org_slug:'

/** ID da organização padrão criada no bootstrap */
export const DEFAULT_ORG_ID = 'aaz-com-jesus'

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Gera um slug URL-friendly a partir de um nome.
 * "AAZ com Jesus" → "aaz-com-jesus"
 */
function slugifyOrgName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'org'
}

// ── CRUD ─────────────────────────────────────────────────────────

/**
 * Cria uma nova organização com wallet associada.
 *
 * Se já existir uma organização com o mesmo slug, adiciona um sufixo
 * para desambiguar. Cria automaticamente uma wallet para a organização.
 *
 * @param params Dados da organização (sem id, slug, walletId, timestamps)
 * @returns A organização criada
 */
export async function createOrganization(params: {
  name: string
  plan: string
  ownerId: string
  type: OrgType
  maxUsers: number
  products: string[]
  leaderCanCreate?: boolean
  billingEmail: string
  id?: string
}): Promise<Organization> {
  const redis = await getRedis()

  // Gera slug a partir do nome
  let slug = params.id ?? slugifyOrgName(params.name)
  let id = slug

  // Garante unicidade do slug
  const existingSlug = await redis.get(`${ORG_SLUG_INDEX}${slug}`)
  if (existingSlug) {
    const suffix = Date.now().toString(36).slice(-4)
    slug = `${slug}-${suffix}`
    id = slug
  }

  // Cria wallet para a organização
  const wallet = await createWallet(id, 'organization')

  const now = new Date().toISOString()
  const org: Organization = {
    id,
    name: params.name.trim(),
    slug,
    plan: params.plan,
    status: 'active',
    ownerId: params.ownerId,
    type: params.type,
    maxUsers: params.maxUsers,
    walletId: wallet.id,
    products: params.products,
    leaderCanCreate: params.leaderCanCreate ?? true,
    billingEmail: params.billingEmail,
    createdAt: now,
    updatedAt: now,
  }

  await redis.set(`${ORG_PREFIX}${id}`, JSON.stringify(org))
  await redis.set(`${ORG_SLUG_INDEX}${slug}`, id)

  return org
}

/**
 * Retorna uma organização pelo id, ou null se não existir.
 */
export async function getOrgById(id: string): Promise<Organization | null> {
  const redis = await getRedis()
  const val = await redis.get(`${ORG_PREFIX}${id}`)
  if (!val) return null
  try {
    return JSON.parse(val) as Organization
  } catch {
    return null
  }
}

/**
 * Retorna uma organização pelo slug, ou null se não existir.
 * Usa o índice secundário `aaz:org_slug:{slug} → id`.
 */
export async function getOrgBySlug(slug: string): Promise<Organization | null> {
  const redis = await getRedis()
  const id = await redis.get(`${ORG_SLUG_INDEX}${slug}`)
  if (!id) return null
  return getOrgById(id)
}

/**
 * Lista todas as organizações. Ordenadas por createdAt descendente.
 * Opcionalmente filtra por status.
 */
export async function listOrganizations(
  statusFilter?: OrgStatus
): Promise<Organization[]> {
  const redis = await getRedis()
  const keys = await redis.keys(`${ORG_PREFIX}*`)
  const orgs: Organization[] = []

  for (const key of keys) {
    // Ignora chaves de índice secundário
    if (key.startsWith(ORG_SLUG_INDEX)) continue
    const val = await redis.get(key)
    if (val) {
      try {
        const org = JSON.parse(val) as Organization
        if (!statusFilter || org.status === statusFilter) {
          orgs.push(org)
        }
      } catch { /* skip malformed */ }
    }
  }

  orgs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  return orgs
}

/**
 * Atualiza campos de uma organização existente.
 * Se o slug mudar, atualiza o índice secundário.
 *
 * @returns A organização atualizada, ou null se não existir.
 */
export async function updateOrganization(
  id: string,
  updates: Partial<Omit<Organization, 'id' | 'createdAt' | 'walletId'>>
): Promise<Organization | null> {
  const redis = await getRedis()
  const current = await getOrgById(id)
  if (!current) return null

  // Se o slug mudou, atualiza o índice secundário
  if (updates.slug && updates.slug !== current.slug) {
    // Verifica se o novo slug já está em uso
    const conflictId = await redis.get(`${ORG_SLUG_INDEX}${updates.slug}`)
    if (conflictId && conflictId !== id) {
      throw new Error(`Slug "${updates.slug}" já está em uso por outra organização.`)
    }
    // Remove o índice antigo, cria o novo
    await redis.del(`${ORG_SLUG_INDEX}${current.slug}`)
    await redis.set(`${ORG_SLUG_INDEX}${updates.slug}`, id)
  }

  const updated: Organization = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  await redis.set(`${ORG_PREFIX}${id}`, JSON.stringify(updated))
  return updated
}

/**
 * Suspende uma organização. Usuários da org perdem acesso
 * mas os dados são preservados.
 *
 * @returns A organização suspensa, ou null se não existir.
 */
export async function suspendOrganization(id: string): Promise<Organization | null> {
  return updateOrganization(id, { status: 'suspended' })
}

/**
 * Reativa uma organização suspensa.
 *
 * @returns A organização reativada, ou null se não existir.
 */
export async function reactivateOrganization(id: string): Promise<Organization | null> {
  return updateOrganization(id, { status: 'active' })
}

// ── Bootstrap ───────────────────────────────────────────────────

/** ID do plano Founder criado no bootstrap */
const FOUNDER_PLAN_ID = 'founder'

/**
 * Bootstrap da organização padrão "AAZ com Jesus".
 *
 * Cria:
 *  1. Um plano "Founder" (se não existir nenhum plano)
 *  2. A organização "AAZ com Jesus" com id='aaz-com-jesus' (se não existir)
 *  3. Uma wallet para a organização (criada automaticamente pelo createOrganization)
 *
 * Idempotente: se a organização já existir, retorna null sem modificar nada.
 * Deve ser chamado no login route ao lado do bootstrapAdminIfEmpty().
 *
 * @param ownerId ID do usuário proprietário (tipicamente o admin bootstrap)
 * @returns A organização criada, ou null se já existia
 */
export async function bootstrapDefaultOrg(ownerId: string): Promise<Organization | null> {
  // Verifica se a org padrão já existe
  const existing = await getOrgById(DEFAULT_ORG_ID)
  if (existing) return null

  // Cria o plano Founder se não existir nenhum plano
  const existingPlans = await listPlans()
  let planId = FOUNDER_PLAN_ID

  if (existingPlans.length === 0) {
    const founderPlan = await createPlan({
      id: FOUNDER_PLAN_ID,
      name: 'Founder',
      type: 'both',
      priceMonthlyUsd: 0,
      creditsMonthlyUsd: 999999,
      maxUsers: 999,
      engines: [], // empty = all engines allowed
      products: ['aaz_studio', 'courses', 'community'],
      isActive: true,
      isFreeTrialEligible: false,
    })
    planId = founderPlan.id
  } else {
    // Se já existem planos, usa o primeiro ativo (ou o Founder se existir)
    const founderPlan = await getPlanById(FOUNDER_PLAN_ID)
    if (founderPlan) {
      planId = founderPlan.id
    } else {
      planId = existingPlans[0].id
    }
  }

  // Cria a organização padrão
  const org = await createOrganization({
    id: DEFAULT_ORG_ID,
    name: 'AAZ com Jesus',
    plan: planId,
    ownerId,
    type: 'team',
    maxUsers: 50,
    products: ['aaz_studio', 'courses', 'community'],
    leaderCanCreate: true,
    billingEmail: 'contato@qiqnada.com.br',
  })

  console.log(`[organizations] Bootstrap org criada: ${org.name} (id=${org.id}, wallet=${org.walletId})`)

  return org
}
