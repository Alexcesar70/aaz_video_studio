import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import { listOrganizations, createOrganization, type OrgType } from '@/lib/organizations'
import { getWallet, addCredits } from '@/lib/wallet'
import { getUsersByOrganization } from '@/lib/users'
import { getPlanById } from '@/lib/plans'

/**
 * GET /api/admin/organizations
 * List all organizations with wallet balance, plan name, member count, status.
 */
export async function GET(request: NextRequest) {
  try {
    requireSuperAdmin(request)

    const orgs = await listOrganizations()

    const result = await Promise.all(
      orgs.map(async (org) => {
        const [wallet, members, plan] = await Promise.all([
          org.walletId ? getWallet(org.walletId) : null,
          getUsersByOrganization(org.id),
          getPlanById(org.plan),
        ])
        return {
          ...org,
          walletBalance: wallet?.balanceUsd ?? 0,
          totalTopUps: wallet?.totalTopUps ?? 0,
          totalSpent: wallet?.totalSpent ?? 0,
          memberCount: members.length,
          planName: plan?.name ?? org.plan,
        }
      })
    )

    return NextResponse.json({ organizations: result })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[/api/admin/organizations GET]', err)
    return NextResponse.json({ error: 'Erro ao listar organizações.' }, { status: 500 })
  }
}

/**
 * POST /api/admin/organizations
 * Create a new organization (with wallet + optional initial credits).
 * Body: { name, plan, ownerId, type, maxUsers, products, billingEmail, leaderCanCreate?, initialCredits? }
 */
export async function POST(request: NextRequest) {
  try {
    const admin = requireSuperAdmin(request)

    const body = await request.json() as {
      name?: string
      plan?: string
      ownerId?: string
      type?: OrgType
      maxUsers?: number
      products?: string[]
      billingEmail?: string
      leaderCanCreate?: boolean
      initialCredits?: number
    }

    if (!body.name || !body.plan || !body.ownerId || !body.type || !body.billingEmail) {
      return NextResponse.json(
        { error: 'name, plan, ownerId, type e billingEmail são obrigatórios.' },
        { status: 400 }
      )
    }

    const org = await createOrganization({
      name: body.name,
      plan: body.plan,
      ownerId: body.ownerId,
      type: body.type,
      maxUsers: body.maxUsers ?? (body.type === 'individual' ? 1 : 10),
      products: body.products ?? ['aaz_studio'],
      leaderCanCreate: body.leaderCanCreate,
      billingEmail: body.billingEmail,
    })

    // Add initial credits if requested
    if (body.initialCredits && body.initialCredits > 0 && org.walletId) {
      await addCredits(
        org.walletId,
        body.initialCredits,
        `Créditos iniciais adicionados por ${admin.name}`,
        { userId: admin.id }
      )
    }

    const wallet = org.walletId ? await getWallet(org.walletId) : null

    return NextResponse.json({
      ok: true,
      organization: {
        ...org,
        walletBalance: wallet?.balanceUsd ?? 0,
      },
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const msg = err instanceof Error ? err.message : 'Erro ao criar organização.'
    console.error('[/api/admin/organizations POST]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
