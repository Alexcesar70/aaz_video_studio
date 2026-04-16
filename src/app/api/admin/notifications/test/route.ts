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
 * Retorna JSON com diagnóstico completo:
 *   - notification persistida
 *   - env vars presentes/ausentes
 *   - recipient resolvido
 *   - deliverer ativo (Resend vs Console)
 *   - resultado (sent / skipped / failed)
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

    // Diagnóstico das env vars (sem expor valores — só presença)
    const hasResendKey = !!process.env.RESEND_API_KEY
    const fromEmail =
      process.env.NOTIFICATION_FROM_EMAIL ?? 'onboarding@resend.dev'

    // 1. Resolve email do admin logado
    const userRepo = new RedisUserRepository()
    const adminUser = await userRepo.findById(admin.id)
    const adminEmail = adminUser?.email ?? null

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
        `Arquitetura: notifyAndQueueEmail → Resend direto (sem Inngest).`,
      link: { href: '/admin', label: 'Voltar ao painel' },
      metadata: {
        testDispatchedAt: new Date().toISOString(),
        dispatchedBy: admin.id,
        fromEmail,
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
      recipientResolver: async () => adminEmail,
    })

    let emailResult: 'sent' | 'skipped' | 'failed' = 'failed'
    let emailError: string | null = null
    try {
      if (!adminEmail) {
        emailResult = 'skipped'
        emailError = 'admin user sem email cadastrado no Redis'
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
        },
      },
      notification: {
        id: notification.id,
        userId: notification.userId,
        title: notification.title,
      },
      hint:
        emailResult === 'sent'
          ? `✅ Email enviado! Verifica inbox de ${adminEmail}. Se não chegar em 1 min, olha spam. ` +
            (delivererName === 'ConsoleEmailDeliverer'
              ? 'ATENÇÃO: está usando Console (só loga), não enviou email real — RESEND_API_KEY ausente.'
              : 'Conferir Resend dashboard (resend.com/emails) se quiser ver o log do envio.')
          : emailResult === 'skipped'
            ? `⚠️ Email pulado: ${emailError}. Adicione um email ao user admin no Redis.`
            : `❌ Falha no envio: ${emailError}. Se for "403: You can only send testing emails...", precisa verificar domínio no Resend OU adicionar o destinatário como test recipient.`,
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
