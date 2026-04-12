import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import { getOrgById } from '@/lib/organizations'
import { getTransactions } from '@/lib/wallet'

/**
 * GET /api/admin/export
 * Exports wallet transactions for an org in the given period as CSV or JSON.
 *
 * Query params:
 *   orgId   (required)  Organization ID
 *   from    (optional)  YYYY-MM-DD start date
 *   to      (optional)  YYYY-MM-DD end date
 *   format  (optional)  'csv' (default) or 'json'
 */
export async function GET(request: NextRequest) {
  try {
    requireSuperAdmin(request)

    const params = request.nextUrl.searchParams
    const orgId = params.get('orgId')
    const fromStr = params.get('from')
    const toStr = params.get('to')
    const format = params.get('format') ?? 'csv'

    if (!orgId) {
      return NextResponse.json(
        { error: 'orgId e obrigatorio.' },
        { status: 400 }
      )
    }

    const org = await getOrgById(orgId)
    if (!org) {
      return NextResponse.json(
        { error: 'Organizacao nao encontrada.' },
        { status: 404 }
      )
    }

    if (!org.walletId) {
      return NextResponse.json(
        { error: 'Organizacao sem wallet.' },
        { status: 400 }
      )
    }

    // Parse date range
    const fromTs = fromStr ? new Date(fromStr + 'T00:00:00Z').getTime() : undefined
    const toTs = toStr ? new Date(toStr + 'T23:59:59.999Z').getTime() : undefined

    const transactions = await getTransactions(org.walletId, {
      from: fromTs,
      to: toTs,
      limit: 10000, // generous limit for export
    })

    if (format === 'json') {
      return NextResponse.json({
        organization: { id: org.id, name: org.name },
        period: { from: fromStr ?? 'all', to: toStr ?? 'all' },
        count: transactions.length,
        transactions,
      })
    }

    // CSV format
    const csvHeader = 'id,date,type,amount_usd,balance_after,description,engine,user_id,generation_type'
    const csvRows = transactions.map((t) => {
      const date = t.createdAt
      const amount = t.amountUsd.toFixed(4)
      const balance = t.balanceAfter.toFixed(4)
      const desc = `"${(t.description || '').replace(/"/g, '""')}"`
      const engine = t.meta?.engineId ?? ''
      const userId = t.meta?.userId ?? ''
      const genType = t.meta?.generationType ?? ''
      return `${t.id},${date},${t.type},${amount},${balance},${desc},${engine},${userId},${genType}`
    })

    const csv = [csvHeader, ...csvRows].join('\n')
    const filename = `transactions_${orgId}_${fromStr ?? 'all'}_${toStr ?? 'all'}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[/api/admin/export GET]', err)
    return NextResponse.json({ error: 'Erro ao exportar dados.' }, { status: 500 })
  }
}
