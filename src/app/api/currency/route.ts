import { NextResponse } from 'next/server'
import { getUsdToBrl } from '@/lib/currency'

/**
 * GET /api/currency
 * Returns the current USD→BRL exchange rate.
 * Public endpoint — no auth required (it's just an exchange rate).
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { rate, source } = await getUsdToBrl()
    return NextResponse.json({
      rate,
      updatedAt: new Date().toISOString(),
      source,
    })
  } catch (err) {
    console.error('[/api/currency GET]', err)
    return NextResponse.json({ error: 'Erro ao buscar cotação.' }, { status: 500 })
  }
}
