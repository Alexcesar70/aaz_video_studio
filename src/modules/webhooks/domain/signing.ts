/**
 * HMAC signing — utilitários puros para assinar e verificar payloads
 * de webhook (Stripe-style: `sha256=<hex>`).
 *
 * Padrão de header: `X-Webhook-Signature: sha256=<64-hex>`
 *
 * Verificação no endpoint externo:
 *   const signed = req.headers['x-webhook-signature']
 *   if (!verifySignature(rawBody, secret, signed)) reject()
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

/**
 * Gera um secret seguro (32 bytes / 64 chars hex). Usado quando uma
 * subscription nova é criada.
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Computa a assinatura `sha256=<hex>` para um payload string.
 */
export function signPayload(rawBody: string, secret: string): string {
  const hex = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  return `sha256=${hex}`
}

/**
 * Verifica assinatura usando comparação timing-safe (constante).
 * Aceita string `sha256=<hex>` ou só `<hex>`.
 */
export function verifySignature(
  rawBody: string,
  secret: string,
  receivedSignature: string,
): boolean {
  const expected = signPayload(rawBody, secret)
  const normalized = receivedSignature.startsWith('sha256=')
    ? receivedSignature
    : `sha256=${receivedSignature}`

  if (expected.length !== normalized.length) return false
  try {
    return timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(normalized, 'utf8'),
    )
  } catch {
    return false
  }
}
