/**
 * Catálogo de eventos Inngest emitidos pelo AAZ Studio.
 *
 * Convenção de nome: `aaz/job.{kind}.requested`.
 * Cada função em `src/inngest/functions/*` se inscreve em exatamente um
 * evento desta lista.
 *
 * O payload sempre inclui `jobId` — o consumidor usa para atualizar o
 * estado do Job via use cases (`markRunning`, `markCompleted`, `markFailed`).
 */

import type { JobKind } from '@/modules/jobs'

export const JOB_EVENT_NAMES = {
  video_generation: 'aaz/job.video_generation.requested',
  image_generation: 'aaz/job.image_generation.requested',
  music_generation: 'aaz/job.music_generation.requested',
  voice_generation: 'aaz/job.voice_generation.requested',
} as const satisfies Record<JobKind, string>

export type JobEventName =
  (typeof JOB_EVENT_NAMES)[keyof typeof JOB_EVENT_NAMES]

export function eventNameForKind(kind: JobKind): JobEventName {
  return JOB_EVENT_NAMES[kind]
}

/**
 * Payload padrão dos eventos de job. O shape de `input` varia por kind —
 * cada função é responsável por validar o seu.
 */
export interface JobRequestedEventData {
  jobId: string
  userId: string
  workspaceId: string | null
  input: unknown
}

/**
 * Eventos de notification — fan-out assíncrono pra canais (email,
 * webhook). O payload é o id da notificação já persistida; quem
 * consome busca o objeto completo do repo.
 */
export const NOTIFICATION_EVENT_NAMES = {
  email: 'aaz/notification.email.requested',
  webhook: 'aaz/notification.webhook.requested',
} as const

export type NotificationEventName =
  (typeof NOTIFICATION_EVENT_NAMES)[keyof typeof NOTIFICATION_EVENT_NAMES]

export interface NotificationEventData {
  notificationId: string
}
