/**
 * POST /api/admin/notifications/test
 *
 * Endpoint de diagnóstico — dispara notification de teste PARA O
 * ADMIN LOGADO e reporta detalhadamente o que aconteceu.
 *
 * Usa a pipeline real: notifyAndQueueEmail() → persiste no Redis →
 * EmailNotificationSender → ResendEmailDeliverer (se
 * RESEND_API_KEY presente) ou ConsoleEmailDeliverer (fallback).
 *
 * Body opcional:
 *   { "overrideTo": "outro@email.com" }
 *
 * Útil em sandbox do Resend (sem domínio verificado) que só permite
 * enviar pro email da conta do Resend. Passar overrideTo faz com
 * que o teste use aquele endereço em vez do email do admin no Redis.
 *
 * Retorna JSON com diagnóstico completo.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, AuthError } from '@/lib/auth'
import {
  createNotification,
  RedisNotificationRepository,
  EmailNotificationSender,
} from '@/modules/notifications'
import { ConsoleEmailDeliverer } from '@/modules/notifications/infra/email/ConsoleEmailDeliverer'
import { ResendEmailDeliverer } from '@/modules/notifications/infra/email/ResendEmailDeliverer'
import { RedisUserRepository } from '@/modules/users'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const admin = requireSuperAdmin(request)

    // Body opcional — permite override do destinatário
    const body = await request.json().catch(() => ({})) as { overrideTo?: string }
    const overrideTo = body.overrideTo?.trim()

    // Diagnóstico das env vars (sem expor valores — só presença)
    const hasResendKey = !!process.env.RESEND_API_KEY
    const fromEmail =
      process.env.NOTIFICATION_FROM_EMAIL ?? 'onboarding@resend.dev'

    // 1. Resolve email do admin logado (ou usa override)
    const userRepo = new RedisUserRepository()
    const adminUser = await userRepo.findById(admin.id)
    const adminEmail = adminUser?.email ?? null
    const recipientEmail = overrideTo ?? adminEmail

    // 2. Persiste notification
    const repo = new RedisNotificationRepository()
    const notification = await createNotification({ repo }, {
      kind: 'system_announcement',
      level: 'info',
      userId: admin.id,
      workspaceId: admin.organizationId ?? null,
      title: 'Teste inline de notification — AAZ Studio',
      body:
        `Se você está lendo este email, a pipeline INLINE está funcionando.\n\n` +
        `Admin (${admin.name}) disparou em ${new Date().toLocaleString('pt-BR')}.\n\n` +
        `Arquitetura: notifyAndQueueEmail → Resend direto (sem Inngest).` +
        (overrideTo ? `\n\nDestinatário forçado via overrideTo: ${overrideTo}` : ''),
      link: { href: '/admin', label: 'Voltar ao painel' },
      metadata: {
        testDispatchedAt: new Date().toISOString(),
        dispatchedBy: admin.id,
        fromEmail,
        overrideTo: overrideTo ?? null,
      },
    })

    // 3. Tenta enviar via EmailNotificationSender (captura TUDO pra diagnóstico)
    const delivererName = hasResendKey ? 'ResendEmailDeliverer' : 'ConsoleEmailDeliverer'
    const deliverer = hasResendKey
      ? new ResendEmailDeliverer({ apiKey: process.env.RESEND_API_KEY! })
      : new ConsoleEmailDeliverer()

    const sender = new EmailNotificationSender({
      emailDeliverer: deliverer,
      defaultFrom: fromEmail,
      // Sempre retorna o recipientEmail escolhido (override ou admin)
      recipientResolver: async () => recipientEmail,
    })

    let emailResult: 'sent' | 'skipped' | 'failed' = 'failed'
    let emailError: string | null = null
    try {
      if (!recipientEmail) {
        emailResult = 'skipped'
        emailError = 'nenhum email disponível (admin sem email no Redis e overrideTo ausente)'
      } else {
        await sender.send(notification)
        emailResult = 'sent'
      }
    } catch (err) {
      emailResult = 'failed'
      emailError = err instanceof Error ? err.message : String(err)
    }

    return NextResponse.json({
      ok: true,
      architecture: 'inline (sem Inngest)',
      diagnostics: {
        env: {
          RESEND_API_KEY: hasResendKey ? 'presente' : 'AUSENTE',
          NOTIFICATION_FROM_EMAIL: fromEmail,
        },
        admin: {
          id: admin.id,
          name: admin.name,
          resolvedEmail: adminEmail ?? '(nenhum email cadastrado)',
        },
        delivery: {
          deliverer: delivererName,
          result: emailResult,
          error: emailError,
          recipientUsed: recipientEmail ?? null,
          overrideApplied: !!overrideTo,
        },
      },
      notification: {
        id: notification.id,
        userId: notification.userId,
        title: notification.title,
      },
      hint:
        emailResult === 'sent'
          ? `✅ Email enviado com sucesso para ${recipientEmail}. Verifica o inbox (+ spam) desse endereço.` +
            (overrideTo
              ? ` (overrideTo aplicado — em produção real, verifique domínio próprio no Resend pra poder enviar pra qualquer email.)`
              : '')
          : emailResult === 'skipped'
            ? `⚠️ Email pulado: ${emailError}.`
            : `❌ Falha: ${emailError}`,
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
