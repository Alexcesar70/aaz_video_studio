import type { JobKind } from '../domain/Job'

/**
 * Contrato de enfileiramento de jobs.
 *
 * Desacopla o ato de "enfileirar" do mecanismo concreto (Inngest, Bull,
 * SQS, cron+loop, inline). O use case `enqueueJob` persiste o Job via
 * `JobRepository` e em seguida chama `runner.enqueue(...)` — o runner
 * apenas dispara o gatilho.
 *
 * Implementações:
 *   - infra/InngestJobRunner (produção, M2-PR2)
 *   - infra/InlineJobRunner  (dev local opcional, executa no mesmo processo)
 *   - infra/NoopJobRunner     (testes que só validam persistência)
 *   - infra/RecordingJobRunner (testes que querem assertar a chamada)
 */
export interface EnqueuePayload {
  jobId: string
  kind: JobKind
  /** Payload do domínio — shape definido por cada kind. */
  input: unknown
  userId: string
  workspaceId: string | null
}

export interface JobRunner {
  /**
   * Dispara o gatilho de execução assíncrona. Deve ser idempotente
   * em relação ao jobId — chamar 2x com o mesmo id é no-op.
   *
   * NÃO deve executar o trabalho inline. Apenas publica o evento na fila.
   * A execução real acontece fora (Inngest function, cron, etc.) e chama
   * de volta no repositório via `markRunning` / `markCompleted` / `markFailed`.
   */
  enqueue(payload: EnqueuePayload): Promise<void>
}
