import type { EnqueuePayload, JobRunner } from '../ports/JobRunner'

/**
 * JobRunner que não faz nada. Útil em testes que só validam persistência
 * do Job, sem se importar com o gatilho.
 */
export class NoopJobRunner implements JobRunner {
  async enqueue(_payload: EnqueuePayload): Promise<void> {
    // intencionalmente vazio
  }
}

/**
 * JobRunner que grava cada chamada de enqueue para asserção em testes.
 */
export class RecordingJobRunner implements JobRunner {
  public readonly calls: EnqueuePayload[] = []

  async enqueue(payload: EnqueuePayload): Promise<void> {
    this.calls.push(payload)
  }

  reset(): void {
    this.calls.length = 0
  }
}
