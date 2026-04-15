# Milestone 6 — Rollout Checklist

> M6 traz notifications + email + webhooks externos + completa
> os scripts de backfill restantes. Tudo gated por env vars
> (não há flag nova) — basta configurar o vendor que quer e o
> sistema começa a notificar.

---

## Pré-requisitos

1. ✅ Tudo do `docs/m5-rollout-checklist.md`.
2. ✅ Conta Resend criada (https://resend.com) com domínio verificado
   e API key gerada.
3. ✅ Backfill rodado para todas as entidades críticas:
   ```bash
   npx tsx scripts/backfill/users.ts
   npx tsx scripts/backfill/workspaces.ts
   npx tsx scripts/backfill/projects.ts
   npx tsx scripts/backfill/episodes.ts
   npx tsx scripts/backfill/wallets.ts
   ```

---

## Env vars a configurar na Vercel

```bash
# Email — sem isto, ConsoleEmailDeliverer assume (logs em vez de envio real)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
NOTIFICATION_FROM_EMAIL=AAZ Studio <noreply@aaz.app>

# Sentry (já no M3-PR6, mas recomendado pra ver delivery failures)
SENTRY_DSN=https://...

# Vercel Cron (já no M5-PR4)
CRON_SECRET=<random-secret>
```

---

## Sequência de rollout

### 1️⃣ Email notifications

O wiring (M6-PR4) já está em produção como código. Sem
`RESEND_API_KEY`, o `ConsoleEmailDeliverer` printa em log
estruturado JSON — ótimo pra validar localmente.

Quando ligar:
```bash
# Adicionar RESEND_API_KEY na Vercel.
# No próximo deploy, sendNotificationEmailFunction (Inngest) começa
# a usar Resend automaticamente.
```

**Validar:**
1. Login como Alexandre.
2. Como admin, entrar em `/admin/organizations/<otra-org>` e
   adicionar $5 de créditos para outra org cujo owner não seja
   o próprio admin.
3. Owner deve receber email no inbox em < 30 segundos.
4. No sino in-app, badge unread+1.
5. Inngest dashboard mostra `send-notification-email` executada.

**Rollback:** remover `RESEND_API_KEY` da Vercel — ConsoleDeliverer
volta automaticamente. Notifications in-app continuam funcionando.

### 2️⃣ Webhooks externos

Foundation está pronta (M6-PR5) mas SEM rota REST nem UI ainda.
Para usar, criar subscription via REPL (futuro: UI no admin):

```typescript
// scripts/admin/subscribe-webhook.ts (a criar)
import {
  RedisWebhookSubscriptionRepository,
  subscribeWebhook,
} from '@/modules/webhooks'

const repo = new RedisWebhookSubscriptionRepository()
const { secret } = await subscribeWebhook({ repo }, {
  workspaceId: 'aaz-com-jesus',
  url: 'https://hooks.zapier.com/hooks/catch/.../',
  kinds: ['episode_approved', 'job_failed'],
  createdBy: 'alexandre',
})
console.log('Secret (copie agora):', secret)
```

PR futuro vai expor:
- `POST /api/webhooks` — subscribe
- `GET /api/webhooks` — list (sem secret)
- `DELETE /api/webhooks/[id]` — unsubscribe
- `POST /api/webhooks/[id]/rotate-secret`
- + UI no admin com lista, criar, rotate

Para o módulo entrar em produção real, falta também conectar
`WebhookNotificationSender` ao fluxo de notify — atualmente o
helper `notifyAndQueueEmail` só dispara email. Wiring de webhook
pode ser via:
- Adicionar evento Inngest `aaz/notification.webhook.requested`
  publicado em paralelo ao email
- Função Inngest `sendNotificationWebhook` que carrega Notification
  + chama WebhookNotificationSender

### 3️⃣ Reconciliation (já no ar desde M5-PR4)

Cron diário `/api/cron/reconcile-wallets` continua rodando.
Adicionar Notification ao fluxo: se divergência > X, notifica
admin via webhook + email com summary.

---

## Métricas a monitorar

Durante o rollout:

- **Email delivery rate** (Resend dashboard): > 95%.
- **In-app unread per user** (Redis SCARD): healthy < 50.
- **Notification creation rate** (Inngest events): proporcional
  a operações reais (top-ups, reviews, job failures).
- **Webhook delivery success rate** (logs warn level): > 90%
  para subscriptions sadias.
- **Sentry events** com tag `feature: notifications` ou
  `feature: webhooks`: zero é o objetivo.

---

## Sumário visual

```
[deploy M6-PR1..7]
      │
      ▼
[backfill scripts (workspaces + projects + episodes)]
      │
      ▼
[Configure RESEND_API_KEY na Vercel]
      │
      ▼
[Wallet top-up + episode review + job failure
 começam a enviar email automaticamente]
      │
      ▼
[Adicionar webhook subscriptions via REPL para validar HMAC]
      │
      ▼
[Próximo PR: rotas REST + UI de webhook subscriptions]
```
