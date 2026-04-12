/**
 * Pricing Table — tabela de preços para clientes.
 *
 * O Super Admin define a margem (fator multiplicador) sobre o custo médio
 * de cada engine. O preço do cliente = custo médio × margem.
 *
 * O custo médio é recalculado automaticamente a partir das últimas 20
 * chamadas reais por engine. Inicialmente usa os valores hardcoded
 * de videoEngines.ts e imageEngines.ts.
 *
 * Redis keys:
 *  - aaz:pricing:config        → PricingConfig JSON (margem, etc.)
 *  - aaz:pricing:engine:{id}   → EnginePricing JSON (custo médio, preço cliente)
 *  - aaz:pricing:costs:{id}    → Lista das últimas 20 custos reais (para média)
 */

import { getRedis } from './redis'

const CONFIG_KEY = 'aaz:pricing:config'
const ENGINE_PREFIX = 'aaz:pricing:engine:'
const COSTS_PREFIX = 'aaz:pricing:costs:'

export interface PricingConfig {
  marginFactor: number       // ex: 1.4 = 40% de margem
  updatedAt: string
  updatedBy: string
}

export interface EnginePricing {
  engineId: string
  engineName: string
  type: 'video' | 'image' | 'director'
  unit: 'second' | 'image' | 'call'
  baseCost: number           // custo médio real (Segmind/Anthropic)
  clientPrice: number        // baseCost × marginFactor
  sampleCount: number        // quantas amostras no cálculo da média
  updatedAt: string
}

// ── Config ──

export async function getPricingConfig(): Promise<PricingConfig> {
  const redis = await getRedis()
  const val = await redis.get(CONFIG_KEY)
  if (val) {
    try { return JSON.parse(val) as PricingConfig } catch {}
  }
  // Default
  return { marginFactor: 1.4, updatedAt: new Date().toISOString(), updatedBy: 'system' }
}

export async function setPricingConfig(marginFactor: number, updatedBy: string): Promise<PricingConfig> {
  const redis = await getRedis()
  const config: PricingConfig = { marginFactor, updatedAt: new Date().toISOString(), updatedBy }
  await redis.set(CONFIG_KEY, JSON.stringify(config))
  // Recalcular todos os preços com a nova margem
  await recalculateAllPrices(marginFactor)
  return config
}

// ── Engine pricing ──

export async function getEnginePricing(engineId: string): Promise<EnginePricing | null> {
  const redis = await getRedis()
  const val = await redis.get(`${ENGINE_PREFIX}${engineId}`)
  if (!val) return null
  try { return JSON.parse(val) as EnginePricing } catch { return null }
}

export async function getAllEnginePricing(): Promise<EnginePricing[]> {
  const redis = await getRedis()
  const keys = await redis.keys(`${ENGINE_PREFIX}*`)
  const results: EnginePricing[] = []
  for (const key of keys) {
    const val = await redis.get(key)
    if (val) {
      try { results.push(JSON.parse(val) as EnginePricing) } catch {}
    }
  }
  return results.sort((a, b) => a.engineId.localeCompare(b.engineId))
}

export async function setEnginePricing(pricing: EnginePricing): Promise<void> {
  const redis = await getRedis()
  await redis.set(`${ENGINE_PREFIX}${pricing.engineId}`, JSON.stringify(pricing))
}

// ── Custo médio dinâmico ──

/** Registra um custo real de uma chamada (para cálculo de média). */
export async function recordEngineCost(engineId: string, costPerUnit: number): Promise<void> {
  const redis = await getRedis()
  const key = `${COSTS_PREFIX}${engineId}`
  // Adiciona ao final da lista
  await redis.rPush(key, costPerUnit.toString())
  // Mantém só os últimos 20
  await redis.lTrim(key, -20, -1)
}

/** Calcula o custo médio das últimas N chamadas. */
export async function getAverageEngineCost(engineId: string): Promise<{ avg: number; count: number }> {
  const redis = await getRedis()
  const key = `${COSTS_PREFIX}${engineId}`
  const vals = await redis.lRange(key, 0, -1)
  if (!vals || vals.length === 0) return { avg: 0, count: 0 }
  const nums = vals.map(v => parseFloat(v)).filter(n => !isNaN(n) && n > 0)
  if (nums.length === 0) return { avg: 0, count: 0 }
  const sum = nums.reduce((s, n) => s + n, 0)
  return { avg: sum / nums.length, count: nums.length }
}

/** Recalcula o preço de todas as engines com a margem dada. */
async function recalculateAllPrices(marginFactor: number): Promise<void> {
  const all = await getAllEnginePricing()
  for (const ep of all) {
    const avg = await getAverageEngineCost(ep.engineId)
    const baseCost = avg.count > 0 ? avg.avg : ep.baseCost
    ep.baseCost = baseCost
    ep.clientPrice = Math.round(baseCost * marginFactor * 10000) / 10000
    ep.sampleCount = avg.count
    ep.updatedAt = new Date().toISOString()
    await setEnginePricing(ep)
  }
}

/** Obtém o preço do cliente para uma engine. Se não existir, usa fallback. */
export async function getClientPrice(engineId: string, fallbackCostPerUnit: number): Promise<number> {
  const pricing = await getEnginePricing(engineId)
  if (pricing && pricing.clientPrice > 0) return pricing.clientPrice
  // Fallback: usa custo hardcoded × margem default
  const config = await getPricingConfig()
  return Math.round(fallbackCostPerUnit * config.marginFactor * 10000) / 10000
}

/** Inicializa a pricing table com os valores default das engines. */
export async function bootstrapPricingTable(): Promise<void> {
  const existing = await getAllEnginePricing()
  if (existing.length > 0) return // já inicializada

  const config = await getPricingConfig()
  const m = config.marginFactor

  const defaults: Omit<EnginePricing, 'clientPrice' | 'sampleCount' | 'updatedAt'>[] = [
    { engineId: 'seedance-2.0', engineName: 'Seedance 2.0', type: 'video', unit: 'second', baseCost: 0.19 },
    { engineId: 'seedance-2.0-fast', engineName: 'Seedance 2.0 Fast', type: 'video', unit: 'second', baseCost: 0.10 },
    { engineId: 'wan-2.7-r2v', engineName: 'Wan 2.7 R2V', type: 'video', unit: 'second', baseCost: 0.12 },
    { engineId: 'kling-2.5-turbo', engineName: 'Kling 2.5 Turbo', type: 'video', unit: 'second', baseCost: 0.35 },
    { engineId: 'veo-3.1-lite', engineName: 'Veo 3.1 Lite', type: 'video', unit: 'second', baseCost: 0.30 },
    { engineId: 'veo-3.1', engineName: 'Veo 3.1', type: 'video', unit: 'second', baseCost: 0.50 },
    { engineId: 'nano-banana-pro', engineName: 'Nano Banana Pro', type: 'image', unit: 'image', baseCost: 0.04 },
    { engineId: 'flux-1-dev', engineName: 'Flux 1 Dev', type: 'image', unit: 'image', baseCost: 0.025 },
    { engineId: 'ideogram-v2', engineName: 'Ideogram V2', type: 'image', unit: 'image', baseCost: 0.08 },
    { engineId: 'scene-director', engineName: 'Scene Director (Claude)', type: 'director', unit: 'call', baseCost: 0.015 },
    { engineId: 'image-director', engineName: 'Image Director (Claude)', type: 'director', unit: 'call', baseCost: 0.005 },
  ]

  const now = new Date().toISOString()
  for (const d of defaults) {
    await setEnginePricing({
      ...d,
      clientPrice: Math.round(d.baseCost * m * 10000) / 10000,
      sampleCount: 0,
      updatedAt: now,
    })
  }
}
