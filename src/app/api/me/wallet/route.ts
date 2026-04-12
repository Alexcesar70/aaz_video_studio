import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { getWalletByOwner, type AlertLevel } from '@/lib/wallet'
import { getOrgById } from '@/lib/organizations'

/**
 * GET /api/me/wallet
 * Retorna informacoes da wallet do usuario autenticado (ou da org dele).
 *
 * - Se o usuario pertence a uma org -> retorna a wallet da org
 * - Se o usuario nao tem org (legacy) -> retorna null (sem wallet)
 *
 * Resposta: {
 *   balance: number,
 *   totalTopUps: number,
 *   totalSpent: number,
 *   alertLevel: AlertLevel,
 *   walletId: string
 * } | { wallet: null }
 */
export const dynamic = 'force-dynamic'

function computeAlertLevel(balanceUsd: number, totalTopUps: number, thresholds: { warning: number; critical: number; danger: number }): AlertLevel {
  if (totalTopUps === 0) return 'ok'
  if (balanceUsd <= 0) return 'empty'
  const remainingPct = (balanceUsd / totalTopUps) * 100
  if (remainingPct <= thresholds.danger) return 'danger'
  if (remainingPct <= thresholds.critical) return 'critical'
  if (remainingPct <= thresholds.warning) return 'warning'
  return 'ok'
}

export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const orgId = authUser.organizationId
    if (!orgId) {
      // Legacy user without organization — no wallet
      return NextResponse.json({ wallet: null })
    }

    const org = await getOrgById(orgId)
    if (!org) {
      return NextResponse.json({ wallet: null })
    }

    const wallet = await getWalletByOwner(orgId, 'organization')
    if (!wallet) {
      return NextResponse.json({ wallet: null })
    }

    const alertLevel = computeAlertLevel(
      wallet.balanceUsd,
      wallet.totalTopUps,
      wallet.alertThresholds
    )

    return NextResponse.json({
      balance: wallet.balanceUsd,
      totalTopUps: wallet.totalTopUps,
      totalSpent: wallet.totalSpent,
      alertLevel,
      walletId: wallet.id,
    })
  } catch (err) {
    console.error('[/api/me/wallet]', err)
    return NextResponse.json({ error: 'Erro ao buscar wallet.' }, { status: 500 })
  }
}
