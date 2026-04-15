/**
 * Episode — container de Scenes dentro de um Project (ou avulso).
 *
 * Shape espelha o definido em `src/components/studio/types.ts` para
 * minimizar fricção na migração — campos de review workflow
 * (`finalStatus`, `reviewNote`, etc.) permanecem idênticos.
 *
 * Regras:
 *   - id: slug não-vazio [a-z0-9_-].
 *   - name: não-vazio.
 *   - workspaceId obrigatório. projectId nullable (episódio avulso).
 *   - finalStatus ∈ FINAL_STATUSES.
 */

export type EpisodeFinalStatus =
  | 'none'
  | 'pending_review'
  | 'approved'
  | 'needs_changes'

export const EPISODE_FINAL_STATUSES: readonly EpisodeFinalStatus[] = [
  'none',
  'pending_review',
  'approved',
  'needs_changes',
] as const

export interface Episode {
  id: string
  name: string
  workspaceId: string
  projectId: string | null
  createdBy: string
  finalVideoUrl?: string
  finalVideoSizeMb?: number
  finalVideoUploadedAt?: string
  finalVideoUploadedBy?: string
  finalStatus: EpisodeFinalStatus
  reviewNote?: string
  reviewedAt?: string
  reviewedBy?: string
  creatorNote?: string
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

export class InvalidEpisodeError extends Error {
  constructor(message: string) {
    super(`Invalid Episode: ${message}`)
    this.name = 'InvalidEpisodeError'
  }
}

const ID_REGEX = /^[a-z0-9_-]+$/

export function validateEpisode(input: Partial<Episode>): Episode {
  if (!input.id || typeof input.id !== 'string') {
    throw new InvalidEpisodeError('id é obrigatório')
  }
  if (!ID_REGEX.test(input.id)) {
    throw new InvalidEpisodeError(
      `id inválido "${input.id}" — use só [a-z0-9_-]`,
    )
  }
  if (!input.name || typeof input.name !== 'string' || !input.name.trim()) {
    throw new InvalidEpisodeError('name é obrigatório')
  }
  if (
    typeof input.workspaceId !== 'string' ||
    input.workspaceId.length === 0
  ) {
    throw new InvalidEpisodeError('workspaceId é obrigatório')
  }
  if (
    input.projectId !== null &&
    input.projectId !== undefined &&
    (typeof input.projectId !== 'string' || input.projectId.length === 0)
  ) {
    throw new InvalidEpisodeError('projectId deve ser string ou null')
  }
  if (typeof input.createdBy !== 'string' || input.createdBy.length === 0) {
    throw new InvalidEpisodeError('createdBy é obrigatório')
  }
  const finalStatus = input.finalStatus ?? 'none'
  if (!EPISODE_FINAL_STATUSES.includes(finalStatus)) {
    throw new InvalidEpisodeError(`finalStatus inválido: ${finalStatus}`)
  }
  if (
    input.finalVideoSizeMb !== undefined &&
    (typeof input.finalVideoSizeMb !== 'number' || input.finalVideoSizeMb < 0)
  ) {
    throw new InvalidEpisodeError('finalVideoSizeMb deve ser >= 0')
  }

  const now = new Date().toISOString()
  return {
    id: input.id,
    name: input.name.trim(),
    workspaceId: input.workspaceId,
    projectId: input.projectId ?? null,
    createdBy: input.createdBy,
    finalVideoUrl: input.finalVideoUrl,
    finalVideoSizeMb: input.finalVideoSizeMb,
    finalVideoUploadedAt: input.finalVideoUploadedAt,
    finalVideoUploadedBy: input.finalVideoUploadedBy,
    finalStatus,
    reviewNote: input.reviewNote,
    reviewedAt: input.reviewedAt,
    reviewedBy: input.reviewedBy,
    creatorNote: input.creatorNote,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  }
}
