/**
 * Cliente utilitário para a Segmind API.
 *
 * Centraliza chamadas administrativas (saldo, logs) separadas dos
 * proxies de geração — que ficam nas API routes.
 */

const CREDITS_ENDPOINT = 'https://api.segmind.com/v1/get-user-credits'

/**
 * Retorna o saldo atual de créditos (em USD) da conta Segmind.
 * Retorna null em caso de falha — o caller deve usar estimativa como fallback.
 *
 * Essa chamada não consome créditos (endpoint administrativo gratuito).
 */
export async function getSegmindCredits(apiKey: string): Promise<number | null> {
  try {
    const res = await fetch(CREDITS_ENDPOINT, {
      method: 'GET',
      headers: { 'x-api-key': apiKey },
    })
    if (!res.ok) return null
    const data = await res.json() as Record<string, unknown>
    // Segmind retorna { credits: number } — tratamos variações defensivamente
    const value =
      typeof data.credits === 'number' ? data.credits :
      typeof data.balance === 'number' ? data.balance :
      typeof data.credit  === 'number' ? data.credit  :
      null
    return value
  } catch {
    return null
  }
}
