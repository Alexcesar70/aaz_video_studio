import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { getWalletByOwner, getTransactions } from '@/lib/wallet'

/**
 * GET /api/me/wallet/export
 * Exports the authenticated user's wallet transactions as CSV.
 *
 * Query params:
 *   from    (optional)  YYYY-MM-DD start date
 *   to      (optional)  YYYY-MM-DD end date
 *   format  (optional)  'csv' (default)
 *
 * CSV columns: Data, Tipo, Descrição, Valor (USD), Saldo (USD)
 */
export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<string, string> = {
  top_up: 'Recarga',
  spend: 'Gasto',
  transfer_in: 'Transferência (entrada)',
  transfer_out: 'Transferência (saída)',
  refund: 'Reembolso',
  adjustment: 'Ajuste',
  monthly_credit: 'Crédito mensal',
}

export async function GET(request: NextRequest) {
  try {
    const user = requireAuth(request)
    const orgId = user.organizationId

    if (!orgId) {
      return new NextResponse('Sem wallet associada.', { status: 400 })
    }

    const wallet = await getWalletByOwner(orgId, 'organization')
    if (!wallet) {
      return new NextResponse('Wallet não encontrada.', { status: 404 })
    }

    const params = request.nextUrl.searchParams
    const fromStr = params.get('from')
    const toStr = params.get('to')

    const fromTs = fromStr ? new Date(fromStr + 'T00:00:00Z').getTime() : undefined
    const toTs = toStr ? new Date(toStr + 'T23:59:59.999Z').getTime() : undefined

    const transactions = await getTransactions(wallet.id, {
      from: fromTs,
      to: toTs,
      limit: 10000,
    })

    // Build CSV
    const BOM = '\uFEFF' // UTF-8 BOM for Excel compatibility
    const csvHeader = 'Data,Tipo,Descrição,Valor (USD),Saldo (USD)'
    const csvRows = transactions.map((t) => {
      const date = new Date(t.createdAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      })
      const tipo = TYPE_LABELS[t.type] ?? t.type
      const desc = `"${(t.description || '').replace(/"/g, '""')}"`
      const amount = t.amountUsd.toFixed(4)
      const balance = t.balanceAfter.toFixed(4)
      return `${date},${tipo},${desc},${amount},${balance}`
    })

    const csv = BOM + [csvHeader, ...csvRows].join('\n')
    const filename = `extrato_${fromStr ?? 'inicio'}_${toStr ?? 'hoje'}.csv`

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
    console.error('[/api/me/wallet/export GET]', err)
    return NextResponse.json({ error: 'Erro ao exportar extrato.' }, { status: 500 })
  }
}
