/**
 * Sentry adapter — implementa o `ErrorReporter` port definido em
 * `@/lib/errorReporter` usando o `@sentry/node` SDK.
 *
 * Boot típico (em `instrumentation.ts` ou equivalente):
 *
 *   // instrumentation.ts
 *   export async function register() {
 *     if (process.env.SENTRY_DSN) {
 *       const { createSentryReporter } = await import('@/lib/errorReporter.sentry')
 *       const { setReporter } = await import('@/lib/errorReporter')
 *       setReporter(
 *         createSentryReporter({
 *           dsn: process.env.SENTRY_DSN,
 *           environment: process.env.VERCEL_ENV ?? 'development',
 *           release: process.env.VERCEL_GIT_COMMIT_SHA,
 *         }),
 *       )
 *     }
 *   }
 *
 * Por que tudo por trás da abstração:
 *   - Sentry SDK não é importado nos call sites (zero lock-in).
 *   - Trocar Sentry → Axiom/Datadog no futuro é outro adapter aqui.
 *   - Se `SENTRY_DSN` não está setado, o default ConsoleErrorReporter
 *     do M2-PR8 continua valendo — zero breaking change.
 */

import * as Sentry from '@sentry/node'
import type {
  ErrorReporter,
  ReportContext,
  ReportSeverity,
} from './errorReporter'

export interface SentryReporterConfig {
  dsn: string
  environment?: string
  release?: string
  /** Sample rate de transactions (0-1). Default 0.1 — 10% das chamadas. */
  tracesSampleRate?: number
  /** Serviço opcional de beforeSend para redact de PII. */
  beforeSend?: (event: Sentry.ErrorEvent) => Sentry.ErrorEvent | null
}

/**
 * Inicializa o Sentry SDK + retorna um `ErrorReporter` que delega
 * chamadas ao client. Idempotente — múltiplas chamadas com o mesmo
 * DSN só inicializam uma vez.
 */
export function createSentryReporter(
  config: SentryReporterConfig,
): ErrorReporter {
  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    tracesSampleRate: config.tracesSampleRate ?? 0.1,
    beforeSend: config.beforeSend,
  })

  return {
    reportError(err: unknown, context: ReportContext = {}): void {
      Sentry.withScope((scope) => {
        applyContext(scope, context)
        if (err instanceof Error) {
          Sentry.captureException(err)
        } else {
          Sentry.captureMessage(String(err), 'error')
        }
      })
    },

    reportMessage(
      message: string,
      severity: ReportSeverity,
      context: ReportContext = {},
    ): void {
      Sentry.withScope((scope) => {
        applyContext(scope, context)
        Sentry.captureMessage(message, toSentrySeverity(severity))
      })
    },
  }
}

function applyContext(scope: Sentry.Scope, context: ReportContext): void {
  if (context.tags) {
    for (const [k, v] of Object.entries(context.tags)) {
      if (v !== undefined) scope.setTag(k, String(v))
    }
  }
  if (context.extra) {
    for (const [k, v] of Object.entries(context.extra)) {
      scope.setExtra(k, v)
    }
  }
  if (context.fingerprint) {
    scope.setFingerprint(context.fingerprint)
  }
}

function toSentrySeverity(
  s: ReportSeverity,
): 'debug' | 'info' | 'warning' | 'error' | 'fatal' {
  // Os níveis batem 1:1 com os do Sentry.
  return s
}
