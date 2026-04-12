import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import { listOrganizations } from '@/lib/organizations'
import { listUsers } from '@/lib/users'
import { getWallet, getTransactions } from '@/lib/wallet'
import { queryEvents } from '@/lib/activity'
import { getSegmindCredits } from '@/lib/segmind'
import { getUsdToBrl } from '@/lib/currency'

/**
 * GET /api/admin/dashboard
 * Global dashboard data for the super admin console.
 */
export async function GET(request: NextRequest) {
  try {
    requireSuperAdmin(request)

    // Fetch all data in parallel
    const [orgs, users, recentEvents, fxRate] = await Promise.all([
      listOrganizations(),
      listUsers(),
      queryEvents({ limit: 20 }),
      getUsdToBrl(),
    ])

    // Segmind balance (best effort)
    let segmindBalance: number | null = null
    const apiKey = process.env.SEGMIND_API_KEY
    if (apiKey) {
      segmindBalance = await getSegmindCredits(apiKey)
    }

    // Org counts
    const activeOrgs = orgs.filter((o) => o.status === 'active').length
    const suspendedOrgs = orgs.filter((o) => o.status === 'suspended').length

    // User counts
    const activeUsers = users.filter((u) => u.status === 'active').length
    const revokedUsers = users.filter((u) => u.status === 'revoked').length

    // Wallet totals: revenue (sum of top_ups) and spend (sum of totalSpent)
    let totalRevenue = 0
    let totalSpent = 0

    // Top 5 orgs by spend this month
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

    interface OrgSpendInfo {
      id: string
      name: string
      monthlySpend: number
      balance: number
    }
    const orgSpends: OrgSpendInfo[] = []

    for (const org of orgs) {
      if (!org.walletId) continue
      const wallet = await getWallet(org.walletId)
      if (!wallet) continue

      totalRevenue += wallet.totalTopUps
      totalSpent += wallet.totalSpent

      // Get this month's transactions
      const monthTxns = await getTransactions(org.walletId, {
        from: monthStart,
        type: 'spend',
        limit: 1000,
      })
      const monthlySpend = monthTxns.reduce(
        (sum, t) => sum + Math.abs(t.amountUsd),
        0
      )

      orgSpends.push({
        id: org.id,
        name: org.name,
        monthlySpend,
        balance: wallet.balanceUsd,
      })
    }

    // Sort by monthly spend descending, take top 5
    orgSpends.sort((a, b) => b.monthlySpend - a.monthlySpend)
    const topOrgs = orgSpends.slice(0, 5)

    return NextResponse.json({
      totalOrgs: orgs.length,
      activeOrgs,
      suspendedOrgs,
      totalUsers: users.length,
      activeUsers,
      revokedUsers,
      totalRevenue,
      totalSpent,
      segmindBalance,
      fxRate: fxRate.rate,
      fxSource: fxRate.source,
      topOrgsBySpend: topOrgs,
      recentActivity: recentEvents,
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[/api/admin/dashboard GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar dashboard.' }, { status: 500 })
  }
}
