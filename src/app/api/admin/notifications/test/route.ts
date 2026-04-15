/**
 * POST /api/admin/notifications/test
 *
 * Endpoint de diagnóstico — dispara uma notification de teste PARA O
 * PRÓPRIO ADMIN LOGADO. Usa a pipeline real (notifyAndQueueEmail →
 * Inngest → Resend) pra validar que toda a cadeia está funcionando.
 *
 * Útil pra:
 * - Confirmar que RESEND_API_KEY está válida
 * - Confirmar que INNGEST_EVENT_KEY + SIGNING_KEY estão válidas e
 *   que o webhook /api/inngest está sincronizado
 * - Confirmar que o user tem email cadastrado
 *
 * Uso: clica o botão "Testar email" no admin OU:
 *   curl -X POST https://<app>/api/admin/notifications/test \
 *     -H "Cookie: aaz_session=<sua-sessao>"
 *
 * Diferente das notifications "reais" (que respeitam a regra de
 * "não notificar o próprio admin"), ESTE endpoint sempre dispara
 * pra quem chamou — pra poder testar.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import { notifyAndQueueEmail } from '@/lib/notificationsWiring'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const admin = requireSuperAdmin(request)

    const notification = await notifyAndQueueEmail({
      kind: 'system_announcement',
      level: 'info',
      userId: admin.id,
      workspaceId: admin.organizationId ?? null,
      title: 'Teste de notificação — AAZ Studio',
      body:
        `Se você está lendo este email, a pipeline de notifications está funcionando:\n\n` +
        `Admin (${admin.name}) disparou em ${new Date().toLocaleString('pt-BR')}.\n\n` +
        `Resend OK, Inngest OK, webhook OK. Pronto pra começar a usar notifications em produção.`,
      link: {
        href: '/admin',
        label: 'Voltar ao painel admin',
      },
      metadata: {
        testDispatchedAt: new Date().toISOString(),
        dispatchedBy: admin.id,
      },
    })

    return NextResponse.json({
      ok: true,
      notification: {
        id: notification.id,
        userId: notification.userId,
        title: notification.title,
        createdAt: notification.createdAt,
      },
      instructions:
        'Notification criada. O email vai chegar via Inngest em alguns segundos. Se não chegar em 30s, verifique: ' +
        '(1) envs INNGEST_EVENT_KEY e INNGEST_SIGNING_KEY na Vercel; ' +
        '(2) webhook /api/inngest sincronizado no dashboard Inngest; ' +
        '(3) RESEND_API_KEY válida; ' +
        '(4) seu user tem email cadastrado.',
    })
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[/api/admin/notifications/test]', err)
    const message = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
