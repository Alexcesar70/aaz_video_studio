import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { getAuthUser, AuthError } from '@/lib/auth'
import { createOrganization } from '@/lib/organizations'
import { getUserById, updateUser } from '@/lib/users'
import { listPlans, createPlan, getPlanById } from '@/lib/plans'
import { addCredits } from '@/lib/wallet'
import { emitEvent } from '@/lib/activity'
import {
  createWorkspaceForUser,
  InvalidWorkspaceInputError,
  UserNotFoundError,
  UserAlreadyHasWorkspaceError,
} from '@/modules/workspaces'

const SESSION_COOKIE = 'aaz_session'
const TRIAL_PLAN_ID = 'trial'

function getSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET não definido')
  return new TextEncoder().encode(secret)
}

/**
 * Resolve o plano default para novos workspaces.
 *
 * Estratégia do M1:
 *   1. Usa o plano 'trial' se existir (M2 vai ter fluxo de billing real).
 *   2. Senão, cria um plano 'trial' minimal (gratuito, 14 dias, 1 user).
 *   3. Para team, usa o primeiro plano ativo que permita maxUsers >= 2,
 *      ou cria um Founder-like se nada existir.
 *
 * Admin pode depois migrar o workspace pra outro plano via super admin.
 */
async function resolveDefaultPlanId(type: 'individual' | 'team'): Promise<string> {
  // Tenta reaproveitar um Trial
  const trial = await getPlanById(TRIAL_PLAN_ID)
  if (trial && trial.isActive) {
    if (type === 'individual' || trial.maxUsers >= 2) return trial.id
  }

  // Cria o Trial plan se não existe (idempotente por id)
  if (!trial) {
    await createPlan({
      id: TRIAL_PLAN_ID,
      name: 'Trial',
      type: 'both',
      priceMonthlyUsd: 0,
      creditsMonthlyUsd: 5, // $5 crédito inicial
      maxUsers: 5,
      engines: [], // all engines
      products: ['aaz_studio'],
      isActive: true,
      isFreeTrialEligible: true,
    })
  }

  // Para team workspaces, tenta achar um plano maior
  if (type === 'team') {
    const plans = await listPlans(true)
    const teamPlan = plans.find(
      (p) => p.maxUsers >= 2 && (p.type === 'team' || p.type === 'both'),
    )
    if (teamPlan) return teamPlan.id
  }

  return TRIAL_PLAN_ID
}

/**
 * POST /api/workspaces
 *
 * Cria um workspace novo e vincula o usuário autenticado como owner.
 *
 * Body:
 *   { name: string, type: 'individual' | 'team', maxUsers?: number }
 *
 * Resposta 200:
 *   { workspace, user } + cookie de sessão atualizado (JWT com orgId)
 *
 * Erros:
 *   400 — input inválido (nome vazio, type errado, maxUsers inconsistente)
 *   401 — não autenticado
 *   409 — user já tem workspace (use o fluxo de switch, não create)
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'não autenticado' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      name?: string
      type?: 'individual' | 'team'
      maxUsers?: number
      billingEmail?: string
    }

    const { workspace, user } = await createWorkspaceForUser(
      {
        getUser: getUserById,
        createOrganization,
        updateUser,
        resolveDefaultPlanId,
        seedWalletCredits: async (walletId, planId) => {
          const plan = await getPlanById(planId)
          if (plan && plan.creditsMonthlyUsd > 0) {
            await addCredits(
              walletId,
              plan.creditsMonthlyUsd,
              `Créditos iniciais do plano ${plan.name}`,
              {},
              'monthly_credit',
            )
          }
        },
      },
      {
        userId: authUser.id,
        input: {
          name: body.name,
          type: body.type,
          maxUsers: body.maxUsers,
          billingEmail: body.billingEmail,
        },
      },
    )

    // Novo JWT incluindo organizationId (user agora faz parte do workspace)
    const tokenPayload: Record<string, unknown> = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      organizationId: workspace.id,
    }
    if (user.permissions && user.permissions.length > 0) {
      tokenPayload.permissions = user.permissions
    }
    if (user.products && user.products.length > 0) {
      tokenPayload.products = user.products
    }
    const token = await new SignJWT(tokenPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(getSecret())

    // Activity event
    emitEvent({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      organizationId: workspace.id,
      type: 'workspace_created',
      meta: {
        label: workspace.name,
        extra: { workspaceType: workspace.type, maxUsers: workspace.maxUsers },
      },
    }).catch(() => {})

    const response = NextResponse.json({
      ok: true,
      workspace: {
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
        type: workspace.type,
        maxUsers: workspace.maxUsers,
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: workspace.id,
        permissions: user.permissions ?? [],
        products: user.products ?? [],
      },
    })

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof InvalidWorkspaceInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof UserNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    if (err instanceof UserAlreadyHasWorkspaceError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    console.error('[POST /api/workspaces]', err)
    return NextResponse.json({ error: 'internal error' }, { status: 500 })
  }
}
