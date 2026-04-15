/**
 * Error reporter — abstração leve sobre observabilidade de erros.
 *
 * Pattern:
 *   import { reportError, reportMessage } from '@/lib/errorReporter'
 *   try { ... } catch (err) {
 *     reportError(err, { tags: { feature: 'video_generation' }, extra: { jobId } })
 *     throw err
 *   }
 *
 * Por que uma abstração em vez de importar Sentry direto:
 *   - Zero dep de infra no primeiro deploy: console.error default funciona.
 *   - Troca de vendor (Sentry → Axiom → Datadog → ...) no futuro é um
 *     só arquivo. Nenhum call site precisa mudar.
 *   - Tests ficam triviais — basta injetar `setReporter(fake)`.
 *
 * Configuração de runtime (opcional):
 *   - SENTRY_DSN ou equivalente não é lido diretamente aqui. O boot
 *     do app (ex.: instrumentation.ts do Next) deve chamar
 *     `setReporter(createSentryReporter(dsn))` quando desejado.
 *   - Enquanto `setReporter` não for chamado, o default registra no
 *     console com formato estruturado (fácil de agregar num log shipper).
 */

export type ReportSeverity = 'debug' | 'info' | 'warning' | 'error' | 'fatal'

export interface ReportContext {
  /** Tags curtas e indexáveis (feature, environment, userId, ...). */
  tags?: Record<string, string | number | boolean | undefined>
  /** Payload livre para inspeção. Cuidado com PII. */
  extra?: Record<string, unknown>
  /** Fingerprint custom para agrupamento (se suportado pelo backend). */
  fingerprint?: string[]
}

export interface ErrorReporter {
  reportError(err: unknown, context?: ReportContext): void
  reportMessage(
    message: string,
    severity: ReportSeverity,
    context?: ReportContext,
  ): void
}

/**
 * Reporter default — escreve estruturado no console. Projetado para ser
 * capturado por um log shipper (Vercel Log Drain → Axiom, por exemplo).
 */
export class ConsoleErrorReporter implements ErrorReporter {
  reportError(err: unknown, context: ReportContext = {}): void {
    const payload = {
      type: 'error_report',
      message: err instanceof Error ? err.message : String(err),
      errorName: err instanceof Error ? err.name : undefined,
      stack: err instanceof Error ? err.stack : undefined,
      tags: compactTags(context.tags),
      extra: context.extra,
      fingerprint: context.fingerprint,
      ts: new Date().toISOString(),
    }
    console.error(JSON.stringify(payload))
  }

  reportMessage(
    message: string,
    severity: ReportSeverity,
    context: ReportContext = {},
  ): void {
    const payload = {
      type: 'message_report',
      message,
      severity,
      tags: compactTags(context.tags),
      extra: context.extra,
      fingerprint: context.fingerprint,
      ts: new Date().toISOString(),
    }
    const fn =
      severity === 'error' || severity === 'fatal'
        ? console.error
        : severity === 'warning'
          ? console.warn
          : console.log
    fn(JSON.stringify(payload))
  }
}

/**
 * Reporter no-op — útil em testes que quiserem silenciar o log.
 */
export class NoopErrorReporter implements ErrorReporter {
  reportError(_err: unknown, _context?: ReportContext): void {
    void _err
    void _context
  }
  reportMessage(
    _message: string,
    _severity: ReportSeverity,
    _context?: ReportContext,
  ): void {
    void _message
    void _severity
    void _context
  }
}

/**
 * Reporter que grava calls em array — testes asseguram que o sistema
 * tentou reportar algo, sem se importar com o backend real.
 */
export class RecordingErrorReporter implements ErrorReporter {
  public readonly errorCalls: Array<{ err: unknown; context?: ReportContext }> = []
  public readonly messageCalls: Array<{
    message: string
    severity: ReportSeverity
    context?: ReportContext
  }> = []

  reportError(err: unknown, context?: ReportContext): void {
    this.errorCalls.push({ err, context })
  }

  reportMessage(
    message: string,
    severity: ReportSeverity,
    context?: ReportContext,
  ): void {
    this.messageCalls.push({ message, severity, context })
  }

  reset(): void {
    this.errorCalls.length = 0
    this.messageCalls.length = 0
  }
}

let current: ErrorReporter = new ConsoleErrorReporter()

/**
 * Substitui o reporter global. Chamar no boot da app (instrumentation.ts,
 * src/inngest/client.ts, etc.) após decidir o vendor.
 */
export function setReporter(reporter: ErrorReporter): void {
  current = reporter
}

/**
 * Retorna o reporter atual. Útil em testes.
 */
export function getReporter(): ErrorReporter {
  return current
}

/**
 * Função conveniente — equivalente a `getReporter().reportError(...)`.
 * Este é o helper que call sites devem usar.
 */
export function reportError(err: unknown, context?: ReportContext): void {
  current.reportError(err, context)
}

export function reportMessage(
  message: string,
  severity: ReportSeverity,
  context?: ReportContext,
): void {
  current.reportMessage(message, severity, context)
}

function compactTags(
  tags?: ReportContext['tags'],
): Record<string, string | number | boolean> | undefined {
  if (!tags) return undefined
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(tags)) {
    if (v !== undefined) out[k] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}
