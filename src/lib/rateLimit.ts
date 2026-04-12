/**
 * Rate limiting para login — proteção contra brute force.
 *
 * Usa Redis para rastrear tentativas por IP e por email.
 * Bloqueia após MAX_ATTEMPTS tentativas em WINDOW_SECONDS.
 *
 * Redis keys (com TTL automático):
 *  - aaz:ratelimit:ip:{ip}       → contador de tentativas
 *  - aaz:ratelimit:email:{email} → contador de tentativas
 *  - aaz:loginlog:{timestamp}    → log de tentativa (auditoria)
 */

import { getRedis } from './redis'

const IP_PREFIX = 'aaz:ratelimit:ip:'
const EMAIL_PREFIX = 'aaz:ratelimit:email:'
const LOG_PREFIX = 'aaz:loginlog'

const MAX_ATTEMPTS = 5          // máximo de tentativas
const WINDOW_SECONDS = 15 * 60  // janela de 15 minutos
const BLOCK_SECONDS = 30 * 60   // bloqueio de 30 minutos após exceder

interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds?: number
  reason?: string
}

/** Verifica se o IP/email pode tentar login. */
export async function checkLoginRateLimit(ip: string, email: string): Promise<RateLimitResult> {
  const redis = await getRedis()

  // Checa IP
  const ipKey = `${IP_PREFIX}${ip}`
  const ipCount = parseInt(await redis.get(ipKey) ?? '0', 10)
  if (ipCount >= MAX_ATTEMPTS) {
    const ttl = await redis.ttl(ipKey)
    return { allowed: false, remaining: 0, retryAfterSeconds: ttl > 0 ? ttl : BLOCK_SECONDS, reason: 'Muitas tentativas deste IP. Tente novamente mais tarde.' }
  }

  // Checa email
  const emailKey = `${EMAIL_PREFIX}${email.toLowerCase()}`
  const emailCount = parseInt(await redis.get(emailKey) ?? '0', 10)
  if (emailCount >= MAX_ATTEMPTS) {
    const ttl = await redis.ttl(emailKey)
    return { allowed: false, remaining: 0, retryAfterSeconds: ttl > 0 ? ttl : BLOCK_SECONDS, reason: 'Muitas tentativas para este email. Tente novamente mais tarde.' }
  }

  const remaining = MAX_ATTEMPTS - Math.max(ipCount, emailCount) - 1
  return { allowed: true, remaining }
}

/** Registra uma tentativa de login (falha ou sucesso). */
export async function recordLoginAttempt(
  ip: string,
  email: string,
  success: boolean,
  userId?: string
): Promise<void> {
  const redis = await getRedis()

  if (!success) {
    // Incrementa contadores
    const ipKey = `${IP_PREFIX}${ip}`
    const emailKey = `${EMAIL_PREFIX}${email.toLowerCase()}`

    const ipCount = await redis.incr(ipKey)
    if (ipCount === 1) await redis.expire(ipKey, WINDOW_SECONDS)
    // Após exceder, estende o bloqueio
    if (ipCount >= MAX_ATTEMPTS) await redis.expire(ipKey, BLOCK_SECONDS)

    const emailCount = await redis.incr(emailKey)
    if (emailCount === 1) await redis.expire(emailKey, WINDOW_SECONDS)
    if (emailCount >= MAX_ATTEMPTS) await redis.expire(emailKey, BLOCK_SECONDS)
  } else {
    // Login ok — limpa contadores
    await redis.del(`${IP_PREFIX}${ip}`)
    await redis.del(`${EMAIL_PREFIX}${email.toLowerCase()}`)
  }

  // Log de auditoria (últimos 500 eventos)
  const log = JSON.stringify({
    ip,
    email: email.toLowerCase(),
    success,
    userId: userId ?? null,
    timestamp: new Date().toISOString(),
  })
  await redis.lPush(LOG_PREFIX, log)
  await redis.lTrim(LOG_PREFIX, 0, 499)
}

/** Retorna os últimos N logs de tentativas de login. */
export async function getLoginLogs(limit = 50): Promise<{
  ip: string; email: string; success: boolean; userId: string | null; timestamp: string
}[]> {
  const redis = await getRedis()
  const raw = await redis.lRange(LOG_PREFIX, 0, limit - 1)
  return raw.map(r => { try { return JSON.parse(r) } catch { return null } }).filter(Boolean)
}
