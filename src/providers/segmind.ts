/**
 * Segmind Provider — implementação concreta de VideoProvider.
 *
 * Esta é a ÚNICA camada que conhece a API do Segmind.
 * Para trocar de provider, cria outro arquivo implementando VideoProvider.
 */

import type { VideoProvider } from '@/domain/videoGeneration'

const FETCH_TIMEOUT_MS = 290_000
const CREDITS_ENDPOINT = 'https://api.segmind.com/v1/get-user-credits'

export class SegmindProvider implements VideoProvider {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async generate(payload: Record<string, unknown>, endpoint: string): Promise<ArrayBuffer> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        let message = `Segmind retornou ${res.status}`
        try {
          const errorData = JSON.parse(errorText)
          message = errorData?.detail ?? errorData?.error ?? errorData?.message ?? message
        } catch {
          if (errorText) message = errorText.slice(0, 200)
        }
        throw new Error(message)
      }

      return await res.arrayBuffer()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('Não respondeu no tempo limite.')
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  async getCredits(): Promise<number | null> {
    try {
      const res = await fetch(CREDITS_ENDPOINT, {
        method: 'GET',
        headers: { 'x-api-key': this.apiKey },
      })
      if (!res.ok) return null
      const data = await res.json() as Record<string, unknown>
      const value =
        typeof data.credits === 'number' ? data.credits :
        typeof data.balance === 'number' ? data.balance :
        typeof data.credit === 'number' ? data.credit :
        null
      return value
    } catch {
      return null
    }
  }
}

/** Factory */
export function createVideoProvider(): VideoProvider {
  const apiKey = process.env.SEGMIND_API_KEY
  if (!apiKey) throw new Error('SEGMIND_API_KEY não configurada')
  return new SegmindProvider(apiKey)
}
