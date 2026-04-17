import type { Organization } from '@/lib/organizations'
import type { PublicUser, User } from '@/lib/users'
import type { CreateWorkspaceInput } from '../domain/workspaceInput'
import { validateCreateWorkspaceInput } from '../domain/workspaceInput'

/**
 * Port do use case — permite testes com fakes.
 * A composition root (rota HTTP) injeta as funções reais de
 * `src/lib/organizations.ts` e `src/lib/users.ts`.
 */
export interface CreateWorkspaceDeps {
  getUser: (id: string) => Promise<User | null>
  createOrganization: (params: {
    name: string
    plan: string
    ownerId: string
    type: 'individual' | 'team'
    maxUsers: number
    products: string[]
    leaderCanCreate?: boolean
    billingEmail: string
    id?: string
  }) => Promise<Organization>
  updateUser: (id: string, patch: Partial<User>) => Promise<PublicUser | null>
  /** Retorna o id do plano default para novos workspaces (ex.: trial) */
  resolveDefaultPlanId: (type: 'individual' | 'team') => Promise<string>
  /** Seed de créditos iniciais do plano na wallet do workspace recém-criado. */
  seedWalletCredits?: (walletId: string, planId: string) => Promise<void>
}

export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`user not found: ${userId}`)
    this.name = 'UserNotFoundError'
  }
}

export class UserAlreadyHasWorkspaceError extends Error {
  constructor(userId: string, workspaceId: string) {
    super(`user ${userId} já pertence ao workspace ${workspaceId}`)
    this.name = 'UserAlreadyHasWorkspaceError'
  }
}

export interface CreateWorkspaceResult {
  workspace: Organization
  user: PublicUser
}

/**
 * Cria um novo workspace e vincula o usuário atual como owner.
 *
 * Regras:
 *   - Usuário deve existir e estar ativo.
 *   - Usuário NÃO pode já ter um workspace (organizationId setado).
 *     Se precisar, crie um fluxo de "switch workspace" separado.
 *   - Individual workspace fixa maxUsers=1 (ADR-0003).
 *   - billingEmail default = email do user.
 *   - Products padrão no M1: todos os produtos (aaz_studio + courses + community).
 *     Plano do workspace define o que efetivamente é liberado.
 *
 * Idempotência: NÃO. Cada chamada cria um workspace novo. O caller
 * deve ter UX (botão submitted, redirect) que evite duplo clique.
 */
export async function createWorkspaceForUser(
  deps: CreateWorkspaceDeps,
  params: {
    userId: string
    input: Partial<CreateWorkspaceInput>
  },
): Promise<CreateWorkspaceResult> {
  const validated = validateCreateWorkspaceInput(params.input)

  const user = await deps.getUser(params.userId)
  if (!user) throw new UserNotFoundError(params.userId)

  if (user.status === 'revoked') {
    throw new Error(`user ${params.userId} está com status=revoked`)
  }

  if (user.organizationId) {
    throw new UserAlreadyHasWorkspaceError(params.userId, user.organizationId)
  }

  const planId = await deps.resolveDefaultPlanId(validated.type)
  const billingEmail = validated.billingEmail ?? user.email

  const workspace = await deps.createOrganization({
    name: validated.name,
    plan: planId,
    ownerId: user.id,
    type: validated.type,
    maxUsers: validated.maxUsers,
    products: ['aaz_studio', 'courses', 'community'],
    leaderCanCreate: validated.type === 'team',
    billingEmail,
  })

  if (workspace.walletId && deps.seedWalletCredits) {
    await deps.seedWalletCredits(workspace.walletId, planId)
  }

  const updatedUser = await deps.updateUser(user.id, {
    organizationId: workspace.id,
  })
  if (!updatedUser) {
    throw new Error(
      `falha ao vincular user ${user.id} ao workspace ${workspace.id}`,
    )
  }

  return { workspace, user: updatedUser }
}
