/**
 * Workspace — domínio.
 *
 * Nota: em M1, "Workspace" é o conceito do produto que mapeia 1:1 ao
 * `Organization` legado. Não duplicamos a persistência — seguimos usando
 * `organizations.ts`. O rename semântico (Organization → Workspace em
 * código) acontece no PR #8.
 *
 * Este módulo contém apenas o que é novo no M1:
 *   - Validação de input para criação de workspace pelo usuário final.
 *   - Uso case `createWorkspaceForUser` orquestrando criação + vínculo.
 *
 * Ver ADR-0003 (workspace individual é apenas workspace com maxUsers=1).
 */

export type WorkspaceType = 'individual' | 'team'

export interface CreateWorkspaceInput {
  name: string
  type: WorkspaceType
  /** Obrigatório para team (>= 2). Ignorado para individual (fixa em 1). */
  maxUsers?: number
  /** Se não informado, usa o email do user criador */
  billingEmail?: string
}

export class InvalidWorkspaceInputError extends Error {
  constructor(message: string) {
    super(`Invalid workspace input: ${message}`)
    this.name = 'InvalidWorkspaceInputError'
  }
}

/**
 * Normaliza e valida input antes de persistir. Retorna a versão
 * efetiva (maxUsers fixado em 1 para individual, etc.) ou lança.
 */
export function validateCreateWorkspaceInput(
  input: Partial<CreateWorkspaceInput>,
): Required<Pick<CreateWorkspaceInput, 'name' | 'type' | 'maxUsers'>> & {
  billingEmail?: string
} {
  if (!input.name?.trim()) {
    throw new InvalidWorkspaceInputError('name é obrigatório')
  }
  if (input.name.trim().length < 2) {
    throw new InvalidWorkspaceInputError('name precisa ter ao menos 2 chars')
  }
  if (input.name.trim().length > 80) {
    throw new InvalidWorkspaceInputError('name excede 80 chars')
  }
  if (input.type !== 'individual' && input.type !== 'team') {
    throw new InvalidWorkspaceInputError(
      `type inválido: "${input.type}" (deve ser individual ou team)`,
    )
  }

  let maxUsers: number
  if (input.type === 'individual') {
    // Individual workspace é Workspace com maxUsers=1. Ver ADR-0003.
    maxUsers = 1
  } else {
    if (typeof input.maxUsers !== 'number' || !Number.isFinite(input.maxUsers)) {
      // Default razoável para team — pode ser ajustado pelo admin depois.
      maxUsers = 5
    } else if (input.maxUsers < 2) {
      throw new InvalidWorkspaceInputError(
        'team workspace precisa de maxUsers >= 2',
      )
    } else if (input.maxUsers > 500) {
      throw new InvalidWorkspaceInputError('maxUsers excede 500')
    } else {
      maxUsers = Math.floor(input.maxUsers)
    }
  }

  return {
    name: input.name.trim(),
    type: input.type,
    maxUsers,
    billingEmail: input.billingEmail?.trim(),
  }
}
