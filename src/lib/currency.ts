/**
 * BRL conversion utility.
 *
 * Fetches current USD→BRL exchange rate from AwesomeAPI (free, no key).
 * Caches the rate in Redis for 1 hour. Falls back to hardcoded 5.50 on failure.
 *
 * Redis key:
 *  - aaz:fx:usd_brl → { rate: number, fetchedAt: string }  (TTL 1h)
 */

import { getRedis } from './redis'

const FX_KEY = 'aaz:fx:usd_brl'
const FX_TTL_SECONDS = 3600 // 1 hour
const FALLBACK_RATE = 5.50
const AWESOME_API_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL'

interface CachedRate {
  rate: number
  fetchedAt: string
}

/**
 * Returns the current USD→BRL exchange rate.
 * Checks Redis cache first. If expired or missing, fetches from AwesomeAPI.
 * Falls back to 5.50 if all else fails.
 */
export async function getUsdToBrl(): Promise<{ rate: number; source: 'api' | 'cache' | 'fallback' }> {
  try {
    const redis = await getRedis()

    // Check cache
    const cached = await redis.get(FX_KEY)
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as CachedRate
        if (parsed.rate > 0) {
          return { rate: parsed.rate, source: 'cache' }
        }
      } catch { /* parse failed, fetch fresh */ }
    }

    // Fetch from API
    try {
      const res = await fetch(AWESOME_API_URL, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const data = await res.json() as Record<string, { bid?: string; ask?: string }>
        const usdBrl = data['USDBRL']
        if (usdBrl) {
          const bid = parseFloat(usdBrl.bid ?? '0')
          const ask = parseFloat(usdBrl.ask ?? '0')
          const rate = bid > 0 && ask > 0 ? (bid + ask) / 2 : bid > 0 ? bid : ask > 0 ? ask : 0

          if (rate > 0) {
            const cachePayload: CachedRate = { rate, fetchedAt: new Date().toISOString() }
            await redis.set(FX_KEY, JSON.stringify(cachePayload), { EX: FX_TTL_SECONDS })
            return { rate, source: 'api' }
          }
        }
      }
    } catch {
      // API call failed, use fallback
    }

    return { rate: FALLBACK_RATE, source: 'fallback' }
  } catch {
    return { rate: FALLBACK_RATE, source: 'fallback' }
  }
}

/**
 * Converts a USD amount to BRL using the current cached rate.
 */
export async function usdToBrl(amountUsd: number): Promise<{ brl: number; rate: number; source: string }> {
  const { rate, source } = await getUsdToBrl()
  return { brl: amountUsd * rate, rate, source }
}
