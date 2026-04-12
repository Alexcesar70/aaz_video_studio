import { NextResponse } from 'next/server'
import { getAllEnginePricing, bootstrapPricingTable } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

/**
 * GET /api/pricing
 * Retorna preços do cliente para todas as engines.
 * Usado pelo studio para mostrar preços estimados ao creator.
 */
export async function GET() {
  try {
    await bootstrapPricingTable()
    const engines = await getAllEnginePricing()
    // Retorna só o que o cliente precisa ver (sem baseCost)
    const clientPrices = engines.map(e => ({
      engineId: e.engineId,
      engineName: e.engineName,
      type: e.type,
      unit: e.unit,
      pricePerUnit: e.clientPrice,
    }))
    return NextResponse.json({ prices: clientPrices })
  } catch (err) {
    console.error('[/api/pricing GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar preços.' }, { status: 500 })
  }
}
