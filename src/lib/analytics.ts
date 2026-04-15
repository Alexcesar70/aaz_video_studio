/**
 * Analytics — abstração leve para tracking de eventos de produto.
 *
 * Mesma filosofia do `errorReporter`: defaults seguros (no-op em
 * SSR + console em dev), adapter PostHog plugado via boot quando há
 * NEXT_PUBLIC_POSTHOG_KEY.
 *
 * Uso em componentes:
 *   import { track, identify } from '@/lib/analytics'
 *
 *   useEffect(() => { identify(user.id, { email, role }) }, [user])
 *   track('video_generated', { engineId, durationSec })
 *
 * **Privacidade:** propriedades passadas em `properties` viram
 * payload no serviço. Cuidado com PII — emails são OK identificadores
 * mas conteúdo de prompts NÃO deve ir aqui.
 */

export interface AnalyticsClient {
  /** Identifica o usuário corrente. Idempotente. */
  identify(userId: string, traits?: Record<string, unknown>): void
  /** Registra um evento nomeado. */
  track(event: string, properties?: Record<string, unknown>): void
  /** Limpa identidade no logout. */
  reset(): void
}

/** No-op default — usado em SSR e quando nenhum vendor está plugado. */
export class NullAnalyticsClient implements AnalyticsClient {
  identify(_userId: string, _traits?: Record<string, unknown>): void {
    void _userId
    void _traits
  }
  track(_event: string, _properties?: Record<string, unknown>): void {
    void _event
    void _properties
  }
  reset(): void {}
}

/**
 * Reporter de console útil em dev — espelha o formato JSON do
 * errorReporter para integração com log shippers.
 */
export class ConsoleAnalyticsClient implements AnalyticsClient {
  identify(userId: string, traits?: Record<string, unknown>): void {
    console.info(
      JSON.stringify({
        type: 'analytics_identify',
        userId,
        traits,
        ts: new Date().toISOString(),
      }),
    )
  }

  track(event: string, properties?: Record<string, unknown>): void {
    console.info(
      JSON.stringify({
        type: 'analytics_track',
        event,
        properties,
        ts: new Date().toISOString(),
      }),
    )
  }

  reset(): void {
    console.info(
      JSON.stringify({
        type: 'analytics_reset',
        ts: new Date().toISOString(),
      }),
    )
  }
}

/** Recording client para testes. */
export class RecordingAnalyticsClient implements AnalyticsClient {
  public readonly identifies: Array<{
    userId: string
    traits?: Record<string, unknown>
  }> = []
  public readonly tracks: Array<{
    event: string
    properties?: Record<string, unknown>
  }> = []
  public resets = 0

  identify(userId: string, traits?: Record<string, unknown>): void {
    this.identifies.push({ userId, traits })
  }
  track(event: string, properties?: Record<string, unknown>): void {
    this.tracks.push({ event, properties })
  }
  reset(): void {
    this.resets++
  }

  clear(): void {
    this.identifies.length = 0
    this.tracks.length = 0
    this.resets = 0
  }
}

let current: AnalyticsClient = new NullAnalyticsClient()

export function setAnalyticsClient(client: AnalyticsClient): void {
  current = client
}

export function getAnalyticsClient(): AnalyticsClient {
  return current
}

// Helpers globais — pattern idêntico ao errorReporter
export function identify(
  userId: string,
  traits?: Record<string, unknown>,
): void {
  current.identify(userId, traits)
}
export function track(
  event: string,
  properties?: Record<string, unknown>,
): void {
  current.track(event, properties)
}
export function resetAnalytics(): void {
  current.reset()
}
