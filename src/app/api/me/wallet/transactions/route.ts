import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { getWalletByOwner, getTransactions } from '@/lib/wallet'

/**
 * GET /api/me/wallet/transactions
 * Returns the authenticated user's wallet transactions.
 *
 * Query params:
 *   from   (optional)  YYYY-MM-DD start date
 *   to     (optional)  YYYY-MM-DD end date
 *   limit  (optional)  max results (default 100)
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request)
    const orgId = user.organizationId

    if (!orgId) {
      return NextResponse.json({ transactions: [] })
    }

    const wallet = await getWalletByOwner(orgId, 'organization')
    if (!wallet) {
      return NextResponse.json({ transactions: [] })
    }

    const params = request.nextUrl.searchParams
    const fromStr = params.get('from')
    const toStr = params.get('to')
    const limitStr = params.get('limit')
    const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 100, 1000) : 100

    const fromTs = fromStr ? new Date(fromStr + 'T00:00:00Z').getTime() : undefined
    const toTs = toStr ? new Date(toStr + 'T23:59:59.999Z').getTime() : undefined

    const transactions = await getTransactions(wallet.id, {
      from: fromTs,
      to: toTs,
      limit,
    })

    return NextResponse.json({ transactions })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[/api/me/wallet/transactions GET]', err)
    return NextResponse.json({ error: 'Erro ao buscar transações.' }, { status: 500 })
  }
}
