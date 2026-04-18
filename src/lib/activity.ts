/**
 * Activity tracking — stream de eventos para o admin panel.
 *
 * Cada ação relevante no app (cena gerada, asset salvo, login, etc)
 * emite um ActivityEvent pro Redis. O admin dashboard consulta esse
 * stream pra montar feeds, KPIs, gráficos de gasto, etc.
 *
 * Armazenamento:
 *  - aaz:activity       sorted set global (score = epoch ms, reverse order pra newest-first)
 *  - aaz:activity:{uid} sorted set por usuário (duplica o global; agiliza query por user)
 *
 * Capacidade:
 *  - Global: últimos 10.000 eventos (prune on write)
 *  - Por usuário: últimos 2.000 eventos cada
 *  - Agregados diários: aaz:daily:{YYYY-MM-DD}:{userId} → JSON com totals
 *    (escrito em tempo real pelo emitEvent, sem cron)
 *
 * Retenção:
 *  - Detalhe: 90 dias efetivos (cap de 10k é normalmente suficiente)
 *  - Agregados: 1 ano (expirado via EXPIRE 365d)
 */

import { getRedis } from './redis'

export type ActivityType =
  | 'login'
  | 'user_created'
  | 'workspace_created'
  | 'scene_generated'
  | 'scene_status_changed'
  | 'scene_deleted'
  | 'image_generated'
  | 'asset_saved'
  | 'asset_deleted'
  | 'asset_promoted'
  | 'scene_director_called'
  | 'image_director_called'
  | 'thumbnail_director_called'
  | 'project_created'
  | 'episode_created'
  | 'episode_delivery_uploaded'
  | 'episode_delivery_reviewed'
  | 'budget_alert'
  | 'budget_exceeded'

export interface ActivityEventMeta {
  /** Custo estimado em USD (quando aplicável) */
  cost?: number
  /** Engine usada (videoEngine id ou imageEngine id) */
  engineId?: string
  /** Duração em segundos (cenas geradas) */
  duration?: number
  /** Número de variações (image generation) */
  variations?: number
  /** Novo status (scene_status_changed) */
  newStatus?: string
  /** Status antigo (scene_status_changed) */
  oldStatus?: string
  /** Tipo de asset (character/scenario/item) */
  assetType?: string
  /** Scene director mood passado */
  mood?: string
  /** Project id */
  projectId?: string
  /** Episode id */
  episodeId?: string
  /** Scene id */
  sceneId?: string
  /** Asset id */
  assetId?: string
  /** User alvo (ex: admin cria outro user) */
  targetUserId?: string
  /** Título humano pra exibir no feed (ex: "A volta de Abigail") */
  label?: string
  /** Qualquer campo extra específico do tipo */
  extra?: Record<string, unknown>
}

export interface ActivityEvent {
  id: string
  userId: string
  userName?: string
  userEmail?: string
  userRole?: string
  /** Organização do usuário no momento do evento (multi-tenant Phase 2) */
  organizationId?: string
  timestamp: string
  type: ActivityType
  meta: ActivityEventMeta
}

const GLOBAL_KEY = 'aaz:activity'
const USER_KEY_PREFIX = 'aaz:activity:'
const DAILY_KEY_PREFIX = 'aaz:daily:'

const MAX_GLOBAL = 10_000
const MAX_PER_USER = 2_000
const DAILY_TTL_SECONDS = 365 * 24 * 60 * 60 // 1 ano

interface DailySummary {
  date: string                     // YYYY-MM-DD
  userId: string
  totalCost: number
  eventCounts: Partial<Record<ActivityType, number>>
  updatedAt: string
}

/**
 * Emite um evento de atividade. Fire-and-forget — nunca deve bloquear
 * a operação principal. Se falhar, loga mas não propaga.
 */
export async function emitEvent(event: Omit<ActivityEvent, 'id' | 'timestamp'>): Promise<void> {
  try {
    const redis = await getRedis()
    const now = Date.now()
    const id = `${now}_${Math.random().toString(36).slice(2, 8)}`
    const timestamp = new Date(now).toISOString()
    const full: ActivityEvent = { id, timestamp, ...event }
    const json = JSON.stringify(full)

    // Global stream (sorted set, newest score = maior)
    await redis.zAdd(GLOBAL_KEY, { score: now, value: json })

    // Prune — mantém últimos MAX_GLOBAL (remove os mais antigos)
    const globalSize = await redis.zCard(GLOBAL_KEY)
    if (globalSize > MAX_GLOBAL) {
      await redis.zRemRangeByRank(GLOBAL_KEY, 0, globalSize - MAX_GLOBAL - 1)
    }

    // Per-user stream
    if (event.userId) {
      const userKey = `${USER_KEY_PREFIX}${event.userId}`
      await redis.zAdd(userKey, { score: now, value: json })
      const userSize = await redis.zCard(userKey)
      if (userSize > MAX_PER_USER) {
        await redis.zRemRangeByRank(userKey, 0, userSize - MAX_PER_USER - 1)
      }
    }

    // Atualiza agregado diário (só se tem cost ou type relevante)
    if (event.userId && (event.meta?.cost || isCountedType(event.type))) {
      await updateDailySummary(event.userId, full)
    }
  } catch (err) {
    console.error('[activity.emitEvent]', err)
  }
}

/**
 * Tipos que sempre contam no agregado diário (mesmo sem cost).
 */
function isCountedType(type: ActivityType): boolean {
  return type === 'scene_generated'
    || type === 'image_generated'
    || type === 'asset_saved'
    || type === 'scene_director_called'
    || type === 'image_director_called'
}

async function updateDailySummary(userId: string, event: ActivityEvent): Promise<void> {
  const redis = await getRedis()
  const date = event.timestamp.slice(0, 10) // YYYY-MM-DD
  const key = `${DAILY_KEY_PREFIX}${date}:${userId}`
  const existing = await redis.get(key)
  let summary: DailySummary
  if (existing) {
    try {
      summary = JSON.parse(existing) as DailySummary
    } catch {
      summary = { date, userId, totalCost: 0, eventCounts: {}, updatedAt: event.timestamp }
    }
  } else {
    summary = { date, userId, totalCost: 0, eventCounts: {}, updatedAt: event.timestamp }
  }

  if (event.meta?.cost) summary.totalCost += event.meta.cost
  summary.eventCounts[event.type] = (summary.eventCounts[event.type] ?? 0) + 1
  summary.updatedAt = event.timestamp

  await redis.set(key, JSON.stringify(summary), { EX: DAILY_TTL_SECONDS })
}

export interface QueryFilter {
  userId?: string
  types?: ActivityType[]
  fromTs?: number  // epoch ms
  toTs?: number    // epoch ms
  limit?: number
}

/**
 * Consulta eventos (newest first). Se userId estiver presente, usa
 * o índice por usuário. Caso contrário, usa o global.
 * Type e date filter são aplicados em JS após o fetch.
 */
export async function queryEvents(filter: QueryFilter = {}): Promise<ActivityEvent[]> {
  const redis = await getRedis()
  const key = filter.userId ? `${USER_KEY_PREFIX}${filter.userId}` : GLOBAL_KEY
  const min = filter.fromTs ?? '-inf'
  const max = filter.toTs ?? '+inf'
  const limit = filter.limit ?? 500

  // zRangeByScore com REV não é direto no node-redis v5 — usa
  // zRange com BYSCORE REV. Mas mais simples: fetch tudo no intervalo,
  // sortear em JS (o volume é baixo, cap 2k por user ou 10k global).
  const raw = await redis.zRangeByScore(key, min, max, { LIMIT: { offset: 0, count: limit * 2 } })

  const parsed: ActivityEvent[] = []
  for (const r of raw) {
    try {
      parsed.push(JSON.parse(r) as ActivityEvent)
    } catch {}
  }

  // Reverse pra newest-first (zRangeByScore volta ascendente)
  parsed.reverse()

  // Filtro por tipo
  const filtered = filter.types && filter.types.length > 0
    ? parsed.filter(e => filter.types!.includes(e.type))
    : parsed

  return filtered.slice(0, limit)
}

/**
 * Retorna o total gasto e a contagem de eventos agregada do mês atual
 * (todos os usuários). Lê os agregados diários pra ser O(n) em dias,
 * não em eventos.
 */
export async function queryMonthlyTotals(yearMonth?: string): Promise<{
  totalCost: number
  eventCounts: Partial<Record<ActivityType, number>>
  byUser: Record<string, { cost: number; counts: Partial<Record<ActivityType, number>> }>
}> {
  const redis = await getRedis()
  const ym = yearMonth ?? new Date().toISOString().slice(0, 7)
  const pattern = `${DAILY_KEY_PREFIX}${ym}-*`
  const keys = await redis.keys(pattern)

  const result = {
    totalCost: 0,
    eventCounts: {} as Partial<Record<ActivityType, number>>,
    byUser: {} as Record<string, { cost: number; counts: Partial<Record<ActivityType, number>> }>,
  }

  for (const key of keys) {
    const val = await redis.get(key)
    if (!val) continue
    try {
      const summary = JSON.parse(val) as DailySummary
      result.totalCost += summary.totalCost
      if (!result.byUser[summary.userId]) {
        result.byUser[summary.userId] = { cost: 0, counts: {} }
      }
      const uBucket = result.byUser[summary.userId]
      uBucket.cost += summary.totalCost
      for (const [type, count] of Object.entries(summary.eventCounts)) {
        const t = type as ActivityType
        result.eventCounts[t] = (result.eventCounts[t] ?? 0) + (count ?? 0)
        uBucket.counts[t] = (uBucket.counts[t] ?? 0) + (count ?? 0)
      }
    } catch {}
  }

  return result
}

/**
 * Soma o gasto do mês atual de um usuário específico (pra budget cap).
 */
export async function queryUserMonthlyCost(userId: string, yearMonth?: string): Promise<number> {
  const redis = await getRedis()
  const ym = yearMonth ?? new Date().toISOString().slice(0, 7)
  const pattern = `${DAILY_KEY_PREFIX}${ym}-*:${userId}`
  const keys = await redis.keys(pattern)
  let total = 0
  for (const key of keys) {
    const val = await redis.get(key)
    if (!val) continue
    try {
      const summary = JSON.parse(val) as DailySummary
      total += summary.totalCost
    } catch {}
  }
  return total
}
