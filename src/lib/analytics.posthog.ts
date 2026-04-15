/**
 * PostHog adapter — implementa `AnalyticsClient` usando o
 * `posthog-js` SDK.
 *
 * Boot típico em `app/providers.tsx` ou layout client:
 *
 *   'use client'
 *   import { useEffect } from 'react'
 *   import {
 *     setAnalyticsClient,
 *     ConsoleAnalyticsClient,
 *   } from '@/lib/analytics'
 *
 *   useEffect(() => {
 *     if (typeof window === 'undefined') return
 *     if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
 *       import('@/lib/analytics.posthog').then(({ createPostHogClient }) => {
 *         setAnalyticsClient(createPostHogClient({
 *           apiKey: process.env.NEXT_PUBLIC_POSTHOG_KEY!,
 *           apiHost: process.env.NEXT_PUBLIC_POSTHOG_HOST,
 *         }))
 *       })
 *     } else if (process.env.NODE_ENV === 'development') {
 *       setAnalyticsClient(new ConsoleAnalyticsClient())
 *     }
 *   }, [])
 *
 * **Importante:** este arquivo só roda no browser (window-only). Em
 * SSR, o boot acima nunca chama init.
 */

import posthog from 'posthog-js'
import type { AnalyticsClient } from './analytics'

export interface PostHogClientConfig {
  apiKey: string
  /** Default: https://us.i.posthog.com */
  apiHost?: string
  /** Default: false. Útil pra debug. */
  debug?: boolean
  /** Capture automático de pageviews/clicks. Default: true. */
  autocapture?: boolean
}

export function createPostHogClient(
  config: PostHogClientConfig,
): AnalyticsClient {
  posthog.init(config.apiKey, {
    api_host: config.apiHost ?? 'https://us.i.posthog.com',
    capture_pageview: config.autocapture ?? true,
    autocapture: config.autocapture ?? true,
    debug: config.debug ?? false,
  })

  return {
    identify(userId: string, traits?: Record<string, unknown>): void {
      posthog.identify(userId, traits)
    },
    track(event: string, properties?: Record<string, unknown>): void {
      posthog.capture(event, properties)
    },
    reset(): void {
      posthog.reset()
    },
  }
}
