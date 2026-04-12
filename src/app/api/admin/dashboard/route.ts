import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import { listOrganizations } from '@/lib/organizations'
import { listUsers } from '@/lib/users'
import { getWallet, getTransactions } from '@/lib/wallet'
import { queryEvents } from '@/lib/activity'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type D = Record<string, any>
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
    const topOrgs = orgSpends.slice(0, 5).map(o => ({ id: o.id, name: o.name, spend: o.monthlySpend }))

    // Orgs com saldo baixo (< 20% do totalTopUps ou < $5)
    const lowBalanceOrgs = orgSpends.filter(o => o.balance < 5 && o.balance >= 0).length

    // Orgs inativas (>7 dias sem atividade)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const activeOrgIds = new Set(recentEvents.filter(e => e.timestamp >= sevenDaysAgo).map(e => (e as D).organizationId).filter(Boolean))
    const inactiveOrgs = orgs.filter(o => o.status === 'active' && !activeOrgIds.has(o.id)).length

    // Gerações hoje e semana
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const genTypes = ['scene_generated', 'image_generated']
    const generationsToday = recentEvents.filter(e => genTypes.includes(e.type) && e.timestamp >= todayStart).length
    const weekEvents = recentEvents.filter(e => genTypes.includes(e.type) && e.timestamp >= weekStart)
    const generationsWeek = weekEvents.length
    const weeklySpend = weekEvents.reduce((s, e) => s + (e.meta?.cost ?? 0), 0)

    // Engine top
    const engineCounts = new Map<string, number>()
    for (const e of recentEvents) {
      if (genTypes.includes(e.type) && e.meta?.engineId) {
        engineCounts.set(e.meta.engineId, (engineCounts.get(e.meta.engineId) ?? 0) + 1)
      }
    }
    const engineList = Array.from(engineCounts.entries()).sort((a, b) => b[1] - a[1])
    const totalGens = engineList.reduce((s, [, n]) => s + n, 0) || 1
    const topEngine = engineList.length > 0 ? engineList[0][0] : null
    const topEnginePercent = engineList.length > 0 ? Math.round((engineList[0][1] / totalGens) * 100) : 0

    // Planos ativos
    const { listPlans } = await import('@/lib/plans')
    const plans = await listPlans()
    const activePlans = plans.filter(p => p.isActive).length

    return NextResponse.json({
      totalOrgs: orgs.length,
      activeOrgs,
      suspendedOrgs,
      totalUsers: users.length,
      activeUsers,
      revokedUsers,
      totalRevenue,
      totalSpend: totalSpent,
      segmindBalance,
      lowBalanceOrgs,
      inactiveOrgs,
      generationsToday,
      generationsWeek,
      weeklySpend,
      topEngine,
      topEnginePercent,
      activePlans,
      topOrgs,
      recentEvents,
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[/api/admin/dashboard GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar dashboard.' }, { status: 500 })
  }
}
