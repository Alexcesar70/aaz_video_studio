import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import {
  getOrgById,
  updateOrganization,
  suspendOrganization,
  reactivateOrganization,
} from '@/lib/organizations'
import { selectWorkspaceRepo } from '@/modules/workspaces'
import { getWallet, addCredits, getTransactions } from '@/lib/wallet'
import { getUsersByOrganization, listUsers, updateUser } from '@/lib/users'
import { getPlanById } from '@/lib/plans'
import { queryEvents } from '@/lib/activity'

/**
 * GET /api/admin/organizations/[id]
 * Full org detail: org + wallet + members + recent events
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = requireSuperAdmin(request)

    // M4-PR3: leitura via composer; default OFF mantém Redis (idêntico ao legado).
    const wsRepo = selectWorkspaceRepo({
      userId: admin.id,
      workspaceId: admin.organizationId,
    })
    const org = await wsRepo.findById(params.id)
    if (!org) {
      return NextResponse.json({ error: 'Organização não encontrada.' }, { status: 404 })
    }

    // Migração: associa users órfãos (sem org) que foram criados por membros desta org
    const allUsers = await listUsers()
    const orgMembers = allUsers.filter(u => u.organizationId === org.id)
    const orgMemberIds = new Set(orgMembers.map(u => u.id))
    const orphans = allUsers.filter(u => !u.organizationId && u.createdBy && orgMemberIds.has(u.createdBy))
    for (const orphan of orphans) {
      await updateUser(orphan.id, { organizationId: org.id })
      console.log(`[admin/org] User ${orphan.id} associado à org ${org.id} (criado por ${orphan.createdBy})`)
    }

    const [wallet, members, plan] = await Promise.all([
      org.walletId ? getWallet(org.walletId) : null,
      getUsersByOrganization(org.id),
      getPlanById(org.plan),
    ])

    const transactions = org.walletId
      ? await getTransactions(org.walletId, { limit: 50 })
      : []

    // Fetch recent events for this org
    const recentEvents = await queryEvents({ limit: 30 })
    const orgEvents = recentEvents.filter((e) => e.organizationId === org.id)

    return NextResponse.json({
      organization: org,
      wallet: wallet
        ? {
            id: wallet.id,
            balanceUsd: wallet.balanceUsd,
            totalTopUps: wallet.totalTopUps,
            totalSpent: wallet.totalSpent,
            alertThresholds: wallet.alertThresholds,
          }
        : null,
      members,
      plan: plan ?? null,
      transactions,
      recentEvents: orgEvents.slice(0, 20),
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[/api/admin/organizations/[id] GET]', err)
    return NextResponse.json({ error: 'Erro ao buscar organização.' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/organizations/[id]
 * Update org (name, plan, status, maxUsers, products)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireSuperAdmin(request)

    const body = await request.json() as {
      name?: string
      plan?: string
      status?: string
      maxUsers?: number
      products?: string[]
      leaderCanCreate?: boolean
      billingEmail?: string
    }

    const updated = await updateOrganization(params.id, body as Partial<Omit<import('@/lib/organizations').Organization, 'id' | 'createdAt' | 'walletId'>>)
    if (!updated) {
      return NextResponse.json({ error: 'Organização não encontrada.' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, organization: updated })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const msg = err instanceof Error ? err.message : 'Erro ao atualizar organização.'
    console.error('[/api/admin/organizations/[id] PATCH]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

/**
 * POST /api/admin/organizations/[id]
 * Actions: add_credits, suspend, reactivate
 * Body: { action: 'add_credits', amount: number, description?: string }
 *   or  { action: 'suspend' }
 *   or  { action: 'reactivate' }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = requireSuperAdmin(request)

    const body = await request.json() as {
      action?: string
      amount?: number
      description?: string
    }

    const org = await getOrgById(params.id)
    if (!org) {
      return NextResponse.json({ error: 'Organização não encontrada.' }, { status: 404 })
    }

    switch (body.action) {
      case 'add_credits': {
        if (!body.amount || body.amount <= 0) {
          return NextResponse.json({ error: 'amount deve ser positivo.' }, { status: 400 })
        }
        if (!org.walletId) {
          return NextResponse.json({ error: 'Organização sem wallet.' }, { status: 400 })
        }
        const txn = await addCredits(
          org.walletId,
          body.amount,
          body.description || `Créditos adicionados por ${admin.name}`,
          { userId: admin.id }
        )
        const wallet = await getWallet(org.walletId)
        return NextResponse.json({ ok: true, transaction: txn, newBalance: wallet?.balanceUsd ?? 0 })
      }

      case 'suspend': {
        const suspended = await suspendOrganization(params.id)
        return NextResponse.json({ ok: true, organization: suspended })
      }

      case 'reactivate': {
        const reactivated = await reactivateOrganization(params.id)
        return NextResponse.json({ ok: true, organization: reactivated })
      }

      default:
        return NextResponse.json({ error: `Ação desconhecida: ${body.action}` }, { status: 400 })
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const msg = err instanceof Error ? err.message : 'Erro na ação.'
    console.error('[/api/admin/organizations/[id] POST]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
