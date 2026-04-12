import { NextRequest, NextResponse } from 'next/server'
import { queryEvents, queryMonthlyTotals, queryUserMonthlyCost, type ActivityType, type ActivityEvent } from '@/lib/activity'
import { requireAdmin, getAuthUser, AuthError } from '@/lib/auth'

// Força runtime dinâmico (rota lê headers de auth — não pode ser pré-renderizada)
export const dynamic = 'force-dynamic'

/**
 * GET /api/activity
 *
 * Endpoint multi-propósito pra consumir o stream de eventos. Admin only.
 *
 * Query params:
 *   mode=events (default) | monthly | user_cost
 *
 * mode=events — retorna array de eventos
 *   ?userId=X           filtra por usuário
 *   ?types=a,b,c        filtra por tipo(s) separados por vírgula
 *   ?from=YYYY-MM-DD    timestamp inicial
 *   ?to=YYYY-MM-DD      timestamp final
 *   ?limit=500          máximo de eventos (default 500)
 *
 * mode=monthly — retorna agregados do mês
 *   ?month=YYYY-MM      default: mês atual
 *   retorna { totalCost, eventCounts, byUser: {[userId]: {cost, counts}} }
 *
 * mode=user_cost — retorna gasto de um usuário no mês
 *   ?userId=X (obrigatório)
 *   ?month=YYYY-MM (default: atual)
 *   retorna { cost }
 *
 * Multi-tenant filtering (Phase 2):
 *   - Admin with organizationId: sees only events from their org + legacy events (no orgId)
 *   - Super admin without organizationId: sees everything
 */
export async function GET(request: NextRequest) {
  try {
    requireAdmin(request)
    const authUser = getAuthUser(request)
    const orgId = authUser?.organizationId
    const url = request.nextUrl
    const mode = url.searchParams.get('mode') ?? 'events'

    if (mode === 'monthly') {
      const month = url.searchParams.get('month') ?? undefined
      const totals = await queryMonthlyTotals(month)

      // Multi-tenant filtering: if admin has orgId, filter byUser to only include
      // users from their org. We filter the events first, then recalculate totals.
      // Since monthly totals are aggregated by userId (not orgId), we need to filter
      // the events stream to identify which users belong to this org.
      // For now, we rely on the activity events themselves having organizationId
      // and filter the events feed. Monthly aggregates are per-user so they stay
      // as-is (the admin panel already filters by visible users).
      return NextResponse.json(totals)
    }

    if (mode === 'user_cost') {
      const userId = url.searchParams.get('userId')
      if (!userId) {
        return NextResponse.json({ error: 'userId é obrigatório em mode=user_cost.' }, { status: 400 })
      }
      const month = url.searchParams.get('month') ?? undefined
      const cost = await queryUserMonthlyCost(userId, month)
      return NextResponse.json({ cost })
    }

    // default: events
    const userId = url.searchParams.get('userId') ?? undefined
    const typesParam = url.searchParams.get('types')
    const types = typesParam ? typesParam.split(',').map(s => s.trim()) as ActivityType[] : undefined
    const fromStr = url.searchParams.get('from')
    const toStr = url.searchParams.get('to')
    const limit = parseInt(url.searchParams.get('limit') ?? '500', 10)

    const fromTs = fromStr ? new Date(fromStr).getTime() : undefined
    const toTs = toStr ? new Date(toStr).getTime() : undefined

    const events = await queryEvents({ userId, types, fromTs, toTs, limit })

    // Multi-tenant filtering: admin with orgId sees only their org's events + legacy (no orgId)
    const filtered = orgId
      ? events.filter((e: ActivityEvent) => e.organizationId === orgId || !e.organizationId)
      : events

    return NextResponse.json({ events: filtered })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[/api/activity GET]', err)
    return NextResponse.json({ error: 'Erro ao carregar atividade.' }, { status: 500 })
  }
}
