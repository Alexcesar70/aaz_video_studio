import { EmailNotificationSender } from '../EmailNotificationSender'
import { ConsoleEmailDeliverer } from './ConsoleEmailDeliverer'
import { ResendEmailDeliverer } from './ResendEmailDeliverer'
import { RedisUserRepository } from '@/modules/users'

const DEFAULT_FROM = 'Creative Studio <noreply@aaz.app>'

interface BuildEmailSenderOverrides {
  recipientResolver?: (userId: string) => Promise<string | null>
  onSkip?: (n: { id: string; kind: string }, reason: string) => void
}

export function buildEmailSender(
  overrides?: BuildEmailSenderOverrides,
): EmailNotificationSender {
  const apiKey = process.env.RESEND_API_KEY
  const deliverer = apiKey
    ? new ResendEmailDeliverer({ apiKey })
    : new ConsoleEmailDeliverer()

  const defaultResolver = async (userId: string) => {
    const userRepo = new RedisUserRepository()
    const u = await userRepo.findById(userId)
    return u?.email ?? null
  }

  return new EmailNotificationSender({
    emailDeliverer: deliverer,
    defaultFrom: process.env.NOTIFICATION_FROM_EMAIL ?? DEFAULT_FROM,
    recipientResolver: overrides?.recipientResolver ?? defaultResolver,
    onSkip: overrides?.onSkip,
  })
}

export { DEFAULT_FROM }
