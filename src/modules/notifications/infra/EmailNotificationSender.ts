/**
 * EmailNotificationSender — adapter que implementa NotificationSender
 * via canal de email.
 *
 * Composição:
 *   - `recipientResolver`: dado um userId, retorna o email do user
 *     (ou null se user não tem email cadastrado / opt-out).
 *   - `emailDeliverer`: o port que faz o envio real (Resend, etc.).
 *   - `defaultFrom`: endereço "from" usado em todos os emails.
 *   - `subjectFormatter` opcional: customiza prefixo do subject.
 *
 * Comportamento:
 *   - Se recipientResolver retorna null, NÃO lança — apenas registra
 *     no `onSkip` callback. Notificação in-app continua valendo.
 *   - Se emailDeliverer lança, propaga (caller faz retry via Inngest).
 *   - Templates HTML/text minimais inline — futuros PRs podem mover
 *     para templates dedicados (MJML, react-email, etc.).
 */

import type { Notification } from '../domain/Notification'
import type { NotificationSender } from '../ports/NotificationSender'
import type { EmailDeliverer, EmailMessage } from '../ports/EmailDeliverer'

export interface EmailNotificationSenderConfig {
  recipientResolver: (userId: string) => Promise<string | null>
  emailDeliverer: EmailDeliverer
  defaultFrom: string
  subjectFormatter?: (n: Notification) => string
  onSkip?: (n: Notification, reason: string) => void
}

const DEFAULT_SUBJECT_PREFIX = '[AAZ Studio] '

export class EmailNotificationSender implements NotificationSender {
  constructor(private readonly cfg: EmailNotificationSenderConfig) {}

  async send(notification: Notification): Promise<void> {
    const to = await this.cfg.recipientResolver(notification.userId)
    if (!to) {
      this.cfg.onSkip?.(notification, 'recipient_not_found')
      return
    }

    const subject =
      this.cfg.subjectFormatter?.(notification) ??
      `${DEFAULT_SUBJECT_PREFIX}${notification.title}`

    const message: EmailMessage = {
      to,
      from: this.cfg.defaultFrom,
      subject,
      html: renderHtml(notification),
      text: renderText(notification),
      tags: {
        kind: notification.kind,
        level: notification.level,
        ...(notification.workspaceId
          ? { workspaceId: notification.workspaceId }
          : {}),
      },
    }
    await this.cfg.emailDeliverer.send(message)
  }
}

function renderText(n: Notification): string {
  const lines: string[] = [n.title, '', n.body]
  if (n.link) {
    lines.push('', `${n.link.label}: ${n.link.href}`)
  }
  lines.push('', '—', 'AAZ Studio')
  return lines.join('\n')
}

function renderHtml(n: Notification): string {
  const safeTitle = escapeHtml(n.title)
  const safeBody = escapeHtml(n.body).replace(/\n/g, '<br>')
  const linkBlock = n.link
    ? `<p style="margin:24px 0;">
        <a href="${escapeAttr(n.link.href)}" style="
          display:inline-block;
          background:#C9A84C;
          color:#13131a;
          padding:12px 22px;
          border-radius:8px;
          font-weight:700;
          text-decoration:none;
          font-family:system-ui,sans-serif;
          font-size:14px;
        ">${escapeHtml(n.link.label)}</a>
      </p>`
    : ''
  return `<!doctype html>
<html><body style="background:#f5f5f5;margin:0;padding:32px;font-family:system-ui,sans-serif;color:#222;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:32px;">
    <tr><td>
      <h1 style="font-size:18px;font-weight:700;margin:0 0 16px 0;">${safeTitle}</h1>
      <p style="font-size:14px;line-height:1.5;margin:0;color:#444;">${safeBody}</p>
      ${linkBlock}
      <p style="font-size:11px;color:#888;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">
        Esta é uma notificação automática do AAZ Studio.
      </p>
    </td></tr>
  </table>
</body></html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/&/g, '&amp;')
}
