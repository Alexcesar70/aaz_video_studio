/**
 * ResendEmailDeliverer — envia via API HTTP do Resend.
 *
 * Usa fetch direto (sem SDK) para evitar adicionar dependência.
 * Resend's API é simples (1 endpoint POST) e estável.
 *
 * Ref: https://resend.com/docs/api-reference/emails/send-email
 *
 * Configuração via env:
 *   RESEND_API_KEY=re_xxx
 *   NOTIFICATION_FROM_EMAIL=AAZ Studio <noreply@aaz.app>
 */

import type {
  EmailDeliverer,
  EmailMessage,
} from '../../ports/EmailDeliverer'

export interface ResendEmailDelivererConfig {
  apiKey: string
  /** Default base URL do Resend (override pra testes). */
  apiBase?: string
  /** Fetch injetável (Node fetch global por padrão). */
  fetchImpl?: typeof fetch
}

interface ResendErrorBody {
  name?: string
  message?: string
  statusCode?: number
}

export class ResendEmailDeliverer implements EmailDeliverer {
  private readonly apiKey: string
  private readonly apiBase: string
  private readonly fetchImpl: typeof fetch

  constructor(cfg: ResendEmailDelivererConfig) {
    this.apiKey = cfg.apiKey
    this.apiBase = cfg.apiBase ?? 'https://api.resend.com'
    this.fetchImpl = cfg.fetchImpl ?? fetch
  }

  async send(message: EmailMessage): Promise<void> {
    if (!message.from) {
      throw new Error('ResendEmailDeliverer: message.from é obrigatório')
    }
    const res = await this.fetchImpl(`${this.apiBase}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        tags: message.tags
          ? Object.entries(message.tags).map(([name, value]) => ({
              name,
              value,
            }))
          : undefined,
      }),
    })
    if (!res.ok) {
      let detail: ResendErrorBody | null = null
      try {
        detail = (await res.json()) as ResendErrorBody
      } catch {
        // ignora
      }
      throw new Error(
        `Resend send failed: HTTP ${res.status}${
          detail?.message ? ` — ${detail.message}` : ''
        }`,
      )
    }
  }
}
