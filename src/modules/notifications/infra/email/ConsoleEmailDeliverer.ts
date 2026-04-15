import type {
  EmailDeliverer,
  EmailMessage,
} from '../../ports/EmailDeliverer'

/**
 * ConsoleEmailDeliverer — printa o email em JSON estruturado.
 * Útil em dev local + como fallback quando RESEND_API_KEY ausente.
 */
export class ConsoleEmailDeliverer implements EmailDeliverer {
  async send(message: EmailMessage): Promise<void> {
    console.info(
      JSON.stringify({
        type: 'email_send',
        to: message.to,
        from: message.from,
        subject: message.subject,
        textPreview: message.text.slice(0, 200),
        tags: message.tags,
        ts: new Date().toISOString(),
      }),
    )
  }
}

/**
 * RecordingEmailDeliverer — para asserções em testes.
 */
export class RecordingEmailDeliverer implements EmailDeliverer {
  public readonly sent: EmailMessage[] = []

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message)
  }

  reset(): void {
    this.sent.length = 0
  }
}
