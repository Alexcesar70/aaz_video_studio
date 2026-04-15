# ADR-0008 — Notifications event-driven (in-app + email + webhooks)

- **Status:** accepted
- **Data:** 2026-04-15
- **Autor:** Alexandre (solo dev)

## Contexto

Com M3 trazendo Postgres + ACID na wallet, M5 entregando Playbooks
e backfills, e usuários reais no produto, a ausência de
**notificações** virou dor:

1. **Wallet sem visibilidade** — admin adiciona créditos, owner
   nem fica sabendo. Saldo baixa, ninguém é avisado antes do
   débito quebrar uma geração.
2. **Episode review sem feedback** — admin aprova/pede ajustes
   editando in-place; o creator só descobre se voltar à UI.
3. **Job failures invisíveis** — Inngest retry esgotou? Nenhum
   alerta ao usuário. Logs do Sentry servem pro dev, não pro user.
4. **Sem integrações externas** — workspaces avançados querem
   plugar Zapier, Slack, custom dashboards. Sem hook out, é
   integração manual.

## Decisão

Adotar **notificações event-driven** com 3 camadas independentes:

### 1. Domain layer — `@/modules/notifications`

- Entity `Notification` com 12 kinds tipados, 3 levels (info |
  warning | critical), userId obrigatório, workspaceId opcional.
- Sempre per-user. Broadcast pra workspace = N notifications
  separadas (preserva read state individual).
- Storage Redis com 3 chaves por user: payload + sorted set +
  unread set. countUnread O(1), list O(log n).
- TTL 90 dias APENAS em notifications lidas. Não-lidas vivem
  enquanto user não interagir.

### 2. Sender layer — `NotificationSender` port

Multiple adapters implementam o port, podendo ser combinados via
`CompositeNotificationSender`:

- **InAppOnly** — não envia (default; só persiste).
- **EmailNotificationSender** + delivery via Resend
  (`ResendEmailDeliverer`) ou Console fallback. Templates HTML+text
  inline com escape de XSS.
- **WebhookNotificationSender** — POST HMAC-signed para
  WebhookSubscription endpoints registrados pelo workspace.

### 3. Wiring layer — `src/lib/notificationsWiring.ts`

`notifyAndQueueEmail()` é o helper canônico:

```ts
await notifyAndQueueEmail({
  kind: 'episode_approved',
  level: 'info',
  userId: creatorId,
  workspaceId,
  title, body, link, metadata,
})
```

O que acontece:
1. Persiste in-app via `RedisNotificationRepository`.
2. Publica evento Inngest `aaz/notification.email.requested`.
3. `sendNotificationEmailFunction` consome → resolve recipient
   email do user → envia via Resend.
4. (Em PR futuro) WebhookNotificationSender consome paralelamente
   e POSTa pra subscriptions ativas.

### 4. Webhooks externos — `@/modules/webhooks`

- `WebhookSubscription` per-workspace com URL https + secret hex
  32-byte + filtro por NotificationKind.
- HMAC-SHA256 (header `X-Webhook-Signature: sha256=<hex>`),
  Stripe-style. Verificação timing-safe.
- Auto-pause em ≥ 5 falhas consecutivas (active=false), reset em
  reativação manual.
- Idempotency via `X-Webhook-Id: <notificationId>`.
- Helpers `signPayload`/`verifySignature` exportados — clientes
  externos podem usar a mesma lib se quiserem.

### Pontos de wiring atuais (M6-PR4)

- `wallet_topped_up` — admin adiciona créditos via
  `/api/admin/organizations/[id]` action=add_credits.
- `episode_approved` / `episode_needs_changes` — admin revisa
  entrega final via `/api/episodes/[id]` action=review.
- `job_failed` — Inngest videoGeneration function após exhausting
  retries.

Cada call site usa `notifyAndQueueEmail().catch(console.error)` —
falha no notify NÃO desfaz a operação primária.

## Consequências

**Positivas:**

- Engajamento via in-app + email sem bloquear flows críticos
  (notify é fire-and-forget).
- Webhooks abrem espaço pra integrações externas sem código
  específico nosso.
- Templates de email centralizados (renderHtml/renderText) — fácil
  ajustar o "look".
- Sentry agrupa falhas de delivery por fingerprint
  (`['notification-email', kind]` etc.) — visibility boa sem flood.

**Negativas / trade-offs:**

- Notification persiste mesmo que o canal falhe. Isso é
  intencional (visível in-app sempre), mas o user pode receber
  notificação no sino sem o email — UX gap a ser comunicado
  ("verifique seu sino também").
- Webhooks com URL inválida geram log noise nos primeiros minutos
  até auto-pause kick in.
- Cada notification cria 2 round-trips Redis (payload + index)
  + 1 publish Inngest. Latency overhead ~10-30ms; aceitável vs.
  bloquear o response.

## Alternativas consideradas

- **Server-Sent Events / WebSockets pra in-app realtime:** mais
  pesado pra Vercel serverless. Polling no sino (a cada 30s) é
  suficiente pra V1.
- **Postmark / SendGrid em vez de Resend:** vendor neutral via
  `EmailDeliverer` port — trocar é 1 arquivo.
- **Inline send (sem Inngest):** simples mas bloqueia o response
  HTTP por 500ms-2s. Inngest com retry resolve isso.
- **Webhook como NotificationKind dedicado:** misturava
  responsabilidades. Manter Webhook como CANAL (Sender) que
  consome qualquer Kind é mais ortogonal.

## Referências

- `src/modules/notifications/` — domain + repos + senders.
- `src/modules/webhooks/` — subscription + HMAC + sender.
- `src/lib/notificationsWiring.ts` — helpers de uso comum.
- `src/inngest/functions/sendNotificationEmail.ts` — função Inngest.
- `docs/m6-rollout-checklist.md` — procedimento operacional.
