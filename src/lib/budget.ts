/**
 * Budget cap checking — garante que o usuário não ultrapassa o limite
 * mensal estabelecido pelo admin.
 *
 * Regra:
 *  - Se user.monthlyBudgetUsd é undefined → sem cap (criadores livres)
 *  - Se gasto acumulado do mês ≥ cap → bloqueio (hard block)
 *  - Se gasto ≥ 80% do cap → warning retornado junto (soft alert)
 *
 * Chamado pelas rotas de geração ANTES de iniciar o call pago, pra
 * evitar cobrar o Segmind quando o user não tem mais budget.
 */

import { getUserById } from './users'
import { queryUserMonthlyCost, emitEvent } from './activity'

export interface BudgetCheckResult {
  allowed: boolean
  usedUsd: number
  capUsd?: number
  percentageUsed?: number
  reason?: string
}

/**
 * Verifica se o usuário pode incorrer no próximo custo estimado.
 * Admins nunca são bloqueados. Users sem cap também.
 *
 * @param userId ID do usuário que vai fazer a operação
 * @param upcomingCost custo estimado da operação em USD
 */
export async function checkBudget(
  userId: string,
  upcomingCost: number
): Promise<BudgetCheckResult> {
  const user = await getUserById(userId)
  if (!user) {
    // Caller deve tratar isso — se não encontra o user, provavelmente
    // é uma sessão inválida. Não bloqueia aqui pra não virar gargalo.
    return { allowed: true, usedUsd: 0 }
  }

  // Admins nunca são bloqueados
  if (user.role === 'admin') {
    return { allowed: true, usedUsd: 0 }
  }

  // Sem cap definido = livre
  if (user.monthlyBudgetUsd === undefined || user.monthlyBudgetUsd === null) {
    return { allowed: true, usedUsd: 0 }
  }

  const currentSpent = await queryUserMonthlyCost(userId)
  const projected = currentSpent + upcomingCost
  const capUsd = user.monthlyBudgetUsd
  const pct = (projected / capUsd) * 100

  if (projected > capUsd) {
    // Hard block — também emite um evento budget_exceeded
    emitEvent({
      userId,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      type: 'budget_exceeded',
      meta: {
        extra: { usedUsd: currentSpent, capUsd, upcomingCost },
      },
    }).catch(() => {})

    return {
      allowed: false,
      usedUsd: currentSpent,
      capUsd,
      percentageUsed: (currentSpent / capUsd) * 100,
      reason: `Budget mensal atingido (~$${currentSpent.toFixed(2)} de $${capUsd}). Fale com o admin pra aumentar o limite.`,
    }
  }

  // Soft alert aos 80%
  if (pct >= 80 && currentSpent / capUsd < 0.8) {
    // Cruzou a linha agora — emite alert uma vez
    emitEvent({
      userId,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      type: 'budget_alert',
      meta: {
        extra: { usedUsd: currentSpent, capUsd, percentageUsed: pct },
      },
    }).catch(() => {})
  }

  return {
    allowed: true,
    usedUsd: currentSpent,
    capUsd,
    percentageUsed: (currentSpent / capUsd) * 100,
  }
}
