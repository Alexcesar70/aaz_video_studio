import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getUserById } from '@/lib/users'
import { queryUserMonthlyCost } from '@/lib/activity'

/**
 * GET /api/me/budget
 * Retorna o gasto e o cap mensal do próprio usuário autenticado.
 * Usado pelo header do studio pra mostrar barra de progresso.
 *
 * Resposta: {
 *   usedUsd: number,
 *   capUsd?: number,        // se undefined, sem cap
 *   percentageUsed?: number // 0-100+
 * }
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const user = await getUserById(authUser.id)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const usedUsd = await queryUserMonthlyCost(authUser.id)
    const capUsd = user.monthlyBudgetUsd
    const percentageUsed = capUsd ? (usedUsd / capUsd) * 100 : undefined
    return NextResponse.json({
      usedUsd,
      capUsd,
      percentageUsed,
    })
  } catch (err) {
    console.error('[/api/me/budget]', err)
    return NextResponse.json({ error: 'Erro ao buscar budget.' }, { status: 500 })
  }
}
