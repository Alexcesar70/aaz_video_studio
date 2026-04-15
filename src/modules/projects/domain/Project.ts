/**
 * Project — entidade de domínio. Um Project é o container raiz de
 * Episodes dentro de um Workspace.
 *
 * Regras:
 *   - id: slug não-vazio [a-z0-9_-].
 *   - name: string não-vazia.
 *   - workspaceId: obrigatório (projeto sempre pertence a um workspace).
 *   - memberIds[]: usuários com acesso explícito. Super_admin vê tudo
 *     independentemente; essa lista é para creators específicos.
 *
 * Este módulo é puro — sem I/O.
 */

export interface Project {
  id: string
  name: string
  workspaceId: string
  createdBy: string
  memberIds: string[]
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

export class InvalidProjectError extends Error {
  constructor(message: string) {
    super(`Invalid Project: ${message}`)
    this.name = 'InvalidProjectError'
  }
}

const ID_REGEX = /^[a-z0-9_-]+$/

export function validateProject(input: Partial<Project>): Project {
  if (!input.id || typeof input.id !== 'string') {
    throw new InvalidProjectError('id é obrigatório')
  }
  if (!ID_REGEX.test(input.id)) {
    throw new InvalidProjectError(
      `id inválido "${input.id}" — use só [a-z0-9_-]`,
    )
  }
  if (!input.name || typeof input.name !== 'string' || !input.name.trim()) {
    throw new InvalidProjectError('name é obrigatório')
  }
  if (
    typeof input.workspaceId !== 'string' ||
    input.workspaceId.length === 0
  ) {
    throw new InvalidProjectError('workspaceId é obrigatório')
  }
  if (typeof input.createdBy !== 'string' || input.createdBy.length === 0) {
    throw new InvalidProjectError('createdBy é obrigatório')
  }
  if (input.memberIds !== undefined && !Array.isArray(input.memberIds)) {
    throw new InvalidProjectError('memberIds deve ser array')
  }

  const now = new Date().toISOString()
  return {
    id: input.id,
    name: input.name.trim(),
    workspaceId: input.workspaceId,
    createdBy: input.createdBy,
    memberIds: input.memberIds ?? [],
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  }
}
