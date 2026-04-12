import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import { getPlanById, updatePlan } from '@/lib/plans'

/**
 * PATCH /api/admin/plans/[id]
 * Update a plan.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireSuperAdmin(request)

    const body = await request.json() as {
      name?: string
      type?: 'individual' | 'team' | 'both'
      priceMonthlyUsd?: number
      creditsMonthlyUsd?: number
      maxUsers?: number
      engines?: string[]
      products?: string[]
      isActive?: boolean
      isFreeTrialEligible?: boolean
    }

    const updated = await updatePlan(params.id, body)
    if (!updated) {
      return NextResponse.json({ error: 'Plano não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, plan: updated })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const msg = err instanceof Error ? err.message : 'Erro ao atualizar plano.'
    console.error('[/api/admin/plans/[id] PATCH]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}

/**
 * DELETE /api/admin/plans/[id]
 * Deactivate a plan (set isActive=false). Does not hard-delete.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    requireSuperAdmin(request)

    const plan = await getPlanById(params.id)
    if (!plan) {
      return NextResponse.json({ error: 'Plano não encontrado.' }, { status: 404 })
    }

    const updated = await updatePlan(params.id, { isActive: false })
    return NextResponse.json({ ok: true, plan: updated })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[/api/admin/plans/[id] DELETE]', err)
    return NextResponse.json({ error: 'Erro ao desativar plano.' }, { status: 500 })
  }
}
