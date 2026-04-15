/**
 * Next.js `instrumentation.ts` — executa no boot de cada runtime
 * (edge, node) antes de qualquer request. É onde trocamos o reporter
 * default pelo Sentry quando o DSN está configurado.
 *
 * Ref: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register(): Promise<void> {
  if (!process.env.SENTRY_DSN) return

  // Import dinâmico pra não carregar @sentry/node quando não há DSN —
  // mantém o bundle do edge runtime enxuto.
  const [{ setReporter }, { createSentryReporter }] = await Promise.all([
    import('./lib/errorReporter'),
    import('./lib/errorReporter.sentry'),
  ])

  setReporter(
    createSentryReporter({
      dsn: process.env.SENTRY_DSN,
      environment:
        process.env.VERCEL_ENV ??
        process.env.NODE_ENV ??
        'development',
      release: process.env.VERCEL_GIT_COMMIT_SHA,
      tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE
        ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
        : 0.1,
    }),
  )

  // eslint-disable-next-line no-console
  console.log(
    '[instrumentation] Sentry reporter ativo — DSN:',
    process.env.SENTRY_DSN?.slice(0, 20) + '...',
  )
}
