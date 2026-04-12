import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import { listUsers } from '@/lib/users'
import { getOrgById } from '@/lib/organizations'
import { getWalletByOwner } from '@/lib/wallet'

/**
 * GET /api/admin/users
 * List ALL users across all orgs (with org name, role, status, wallet balance).
 * Supports query param ?orgId=X to filter by org.
 */
export async function GET(request: NextRequest) {
  try {
    requireSuperAdmin(request)

    const orgIdFilter = request.nextUrl.searchParams.get('orgId')

    const allUsers = await listUsers()

    // Filter by org if requested
    const filtered = orgIdFilter
      ? allUsers.filter((u) => u.organizationId === orgIdFilter)
      : allUsers

    // Enrich with org name and wallet balance
    // Cache org lookups to avoid redundant reads
    const orgCache = new Map<string, { name: string; walletBalance: number }>()

    const enriched = await Promise.all(
      filtered.map(async (user) => {
        let orgName = ''
        let walletBalance = 0

        if (user.organizationId) {
          const cached = orgCache.get(user.organizationId)
          if (cached) {
            orgName = cached.name
            walletBalance = cached.walletBalance
          } else {
            const org = await getOrgById(user.organizationId)
            if (org) {
              const wallet = await getWalletByOwner(org.id, 'organization')
              orgName = org.name
              walletBalance = wallet?.balanceUsd ?? 0
              orgCache.set(user.organizationId, { name: orgName, walletBalance })
            }
          }
        }

        return {
          ...user,
          orgName,
          orgWalletBalance: walletBalance,
        }
      })
    )

    return NextResponse.json({ users: enriched })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[/api/admin/users GET]', err)
    return NextResponse.json({ error: 'Erro ao listar usuários.' }, { status: 500 })
  }
}
