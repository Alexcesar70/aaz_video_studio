import { describe, it, expect } from 'vitest'
import {
  InngestJobRunner,
  type InngestLikeClient,
  type EventNameResolver,
} from '@/modules/jobs'

function makeClient(): { client: InngestLikeClient; calls: Array<{ name: string; data: Record<string, unknown> }> } {
  const calls: Array<{ name: string; data: Record<string, unknown> }> = []
  return {
    calls,
    client: {
      async send(event) {
        calls.push({ name: event.name, data: event.data })
        return { ids: ['evt_' + calls.length] }
      },
    },
  }
}

describe('InngestJobRunner', () => {
  const resolver: EventNameResolver = (kind) => `aaz/job.${kind}.requested`

  it('publica evento com nome resolvido pelo EventNameResolver', async () => {
    const { client, calls } = makeClient()
    const runner = new InngestJobRunner(client, resolver)

    await runner.enqueue({
      jobId: 'job-1',
      kind: 'video_generation',
      input: { prompt: 'hi' },
      userId: 'user-1',
      workspaceId: 'ws-1',
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].name).toBe('aaz/job.video_generation.requested')
  })

  it('inclui jobId, userId, workspaceId e input no data do evento', async () => {
    const { client, calls } = makeClient()
    const runner = new InngestJobRunner(client, resolver)

    await runner.enqueue({
      jobId: 'job-xyz',
      kind: 'image_generation',
      input: { prompt: 'a cat' },
      userId: 'alice',
      workspaceId: 'ws-9',
    })

    expect(calls[0].data.jobId).toBe('job-xyz')
    expect(calls[0].data.userId).toBe('alice')
    expect(calls[0].data.workspaceId).toBe('ws-9')
    expect(calls[0].data.input).toEqual({ prompt: 'a cat' })
  })

  it('preserva workspaceId null', async () => {
    const { client, calls } = makeClient()
    const runner = new InngestJobRunner(client, resolver)

    await runner.enqueue({
      jobId: 'j',
      kind: 'video_generation',
      input: {},
      userId: 'u',
      workspaceId: null,
    })

    expect(calls[0].data.workspaceId).toBeNull()
  })

  it('usa nome diferente para cada kind via resolver', async () => {
    const { client, calls } = makeClient()
    const runner = new InngestJobRunner(client, resolver)

    await runner.enqueue({
      jobId: 'a',
      kind: 'video_generation',
      input: {},
      userId: 'u',
      workspaceId: null,
    })
    await runner.enqueue({
      jobId: 'b',
      kind: 'music_generation',
      input: {},
      userId: 'u',
      workspaceId: null,
    })

    expect(calls[0].name).toBe('aaz/job.video_generation.requested')
    expect(calls[1].name).toBe('aaz/job.music_generation.requested')
  })

  it('propaga erros do client.send', async () => {
    const failing: InngestLikeClient = {
      async send() {
        throw new Error('inngest down')
      },
    }
    const runner = new InngestJobRunner(failing, resolver)

    await expect(
      runner.enqueue({
        jobId: 'x',
        kind: 'video_generation',
        input: {},
        userId: 'u',
        workspaceId: null,
      }),
    ).rejects.toThrow('inngest down')
  })
})
