import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import { listPlans, createPlan, type Plan } from '@/lib/plans'

/**
 * GET /api/admin/plans
 * List all plans.
 */
export async function GET(request: NextRequest) {
  try {
    requireSuperAdmin(request)
    const plans = await listPlans()
    return NextResponse.json({ plans })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[/api/admin/plans GET]', err)
    return NextResponse.json({ error: 'Erro ao listar planos.' }, { status: 500 })
  }
}

/**
 * POST /api/admin/plans
 * Create a plan.
 * Body: { id, name, type, priceMonthlyUsd, creditsMonthlyUsd, maxUsers, engines?, products?, isActive?, isFreeTrialEligible? }
 */
export async function POST(request: NextRequest) {
  try {
    requireSuperAdmin(request)

    const body = await request.json() as Partial<Plan>

    if (!body.id || !body.name || !body.type) {
      return NextResponse.json(
        { error: 'id, name e type são obrigatórios.' },
        { status: 400 }
      )
    }

    const plan = await createPlan({
      id: body.id,
      name: body.name,
      type: body.type,
      priceMonthlyUsd: body.priceMonthlyUsd ?? 0,
      creditsMonthlyUsd: body.creditsMonthlyUsd ?? 0,
      maxUsers: body.maxUsers ?? 1,
      engines: body.engines,
      products: body.products,
      isActive: body.isActive,
      isFreeTrialEligible: body.isFreeTrialEligible,
    })

    return NextResponse.json({ ok: true, plan })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const msg = err instanceof Error ? err.message : 'Erro ao criar plano.'
    console.error('[/api/admin/plans POST]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
