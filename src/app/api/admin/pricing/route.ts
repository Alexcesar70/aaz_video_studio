import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import {
  getPricingConfig,
  setPricingConfig,
  getAllEnginePricing,
  setEnginePricing,
  bootstrapPricingTable,
  type EnginePricing,
} from '@/lib/pricing'

/**
 * GET /api/admin/pricing
 * Retorna config de margem + tabela completa de preços por engine.
 */
export async function GET(request: NextRequest) {
  try {
    requireSuperAdmin(request)
    await bootstrapPricingTable()
    const [config, engines] = await Promise.all([
      getPricingConfig(),
      getAllEnginePricing(),
    ])
    return NextResponse.json({ config, engines })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[/api/admin/pricing GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar pricing.' }, { status: 500 })
  }
}

/**
 * POST /api/admin/pricing
 * Ações: update_margin, update_engine
 */
export async function POST(request: NextRequest) {
  try {
    const user = requireSuperAdmin(request)
    const body = await request.json()

    if (body.action === 'update_margin') {
      const factor = parseFloat(body.marginFactor)
      if (!factor || factor < 1 || factor > 10) {
        return NextResponse.json({ error: 'Fator deve ser entre 1.0 e 10.0' }, { status: 400 })
      }
      const config = await setPricingConfig(factor, user.id)
      const engines = await getAllEnginePricing()
      return NextResponse.json({ ok: true, config, engines })
    }

    if (body.action === 'update_engine') {
      const ep = body.engine as Partial<EnginePricing>
      if (!ep.engineId) return NextResponse.json({ error: 'engineId obrigatório' }, { status: 400 })
      const existing = (await getAllEnginePricing()).find(e => e.engineId === ep.engineId)
      if (!existing) return NextResponse.json({ error: 'Engine não encontrada' }, { status: 404 })
      const config = await getPricingConfig()
      const updated: EnginePricing = {
        ...existing,
        baseCost: ep.baseCost ?? existing.baseCost,
        clientPrice: Math.round((ep.baseCost ?? existing.baseCost) * config.marginFactor * 10000) / 10000,
        engineName: ep.engineName ?? existing.engineName,
        updatedAt: new Date().toISOString(),
      }
      await setEnginePricing(updated)
      return NextResponse.json({ ok: true, engine: updated })
    }

    return NextResponse.json({ error: 'action inválida' }, { status: 400 })
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('[/api/admin/pricing POST]', err)
    return NextResponse.json({ error: 'Erro ao atualizar pricing.' }, { status: 500 })
  }
}
