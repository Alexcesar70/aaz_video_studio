/**
 * EmailDeliverer — port que abstrai o envio de email transacional.
 *
 * Implementações:
 *   - infra/email/ConsoleEmailDeliverer.ts (dev / fallback)
 *   - infra/email/ResendEmailDeliverer.ts (produção via Resend)
 *
 * Outros vendors (Postmark, SendGrid, SES) vêm em adapters próprios
 * sem mudar este contrato.
 */
export interface EmailMessage {
  to: string
  /** From address. Default da app pode ser injetado pelo factory. */
  from?: string
  subject: string
  /** Versão HTML (preferida pelos clientes modernos). */
  html: string
  /** Versão plain-text (fallback obrigatório por anti-spam). */
  text: string
  /** Tags pra agrupamento no provider (analytics, suppression lists). */
  tags?: Record<string, string>
}

export interface EmailDeliverer {
  /**
   * Envia um email transacional.
   * Lança em caso de falha — caller (Inngest) faz retry.
   */
  send(message: EmailMessage): Promise<void>
}
