import type { EnqueuePayload, JobRunner } from '../ports/JobRunner'

/**
 * Contrato mínimo de um cliente de fila que sabe publicar eventos nomeados.
 * É compatível com o SDK do Inngest (`Inngest#send`) mas não depende dele —
 * isso permite mocks de teste e troca futura (SQS, Temporal, etc.).
 */
export interface InngestLikeClient {
  send(event: { name: string; data: Record<string, unknown> }): Promise<unknown>
}

/**
 * Mapeia um kind de Job para o nome do evento Inngest que o worker
 * consome. Deve permanecer alinhado com `src/inngest/events.ts`.
 */
export type EventNameResolver = (kind: EnqueuePayload['kind']) => string

/**
 * Adapter que implementa `JobRunner` publicando eventos em um cliente
 * tipo Inngest. Não executa trabalho — apenas dispara o gatilho.
 *
 * Injeção de dependência:
 *   - `client`: qualquer objeto com `send(...)` (o próprio Inngest SDK
 *     ou um fake de testes).
 *   - `eventName`: função pura JobKind → nome do evento.
 */
export class InngestJobRunner implements JobRunner {
  constructor(
    private readonly client: InngestLikeClient,
    private readonly eventName: EventNameResolver,
  ) {}

  async enqueue(payload: EnqueuePayload): Promise<void> {
    await this.client.send({
      name: this.eventName(payload.kind),
      data: {
        jobId: payload.jobId,
        userId: payload.userId,
        workspaceId: payload.workspaceId,
        input: payload.input as Record<string, unknown>,
      },
    })
  }
}
