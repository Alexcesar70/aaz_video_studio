# Milestone 4 — Rollout Checklist (Wiring + Observability + Decomposition)

> M4 conecta os adapters Postgres entregues no M3 às rotas de
> produção, atrás de feature flags. Cada flag tem o mesmo padrão:
> canário → global → consolidação. Para Wallet (dinheiro) há etapa
> intermediária obrigatória de **dual-write**.

---

## Pré-requisitos

1. ✅ Tudo do `docs/m3-rollout-checklist.md` (Postgres provisionado,
   `DATABASE_URL` setado, `npm run db:migrate` aplicado).
2. ✅ Backfill rodado para entidades que serão lidas via Postgres:
   ```bash
   npx tsx scripts/backfill/users.ts
   npx tsx scripts/backfill/wallets.ts
   ```
3. ✅ Sentry DSN configurado (`SENTRY_DSN`) — captura divergências
   silenciosas do dual-write via `reportError`.

---

## Flags do M4

| Flag | Adapter | Rota wired | Risco |
|---|---|---|---|
| `USE_POSTGRES_USERS` | `selectUserRepo` | `/api/users` (GET), `/api/users/[id]` (GET) | médio |
| `USE_POSTGRES_WORKSPACES` | `selectWorkspaceRepo` | `/api/admin/organizations/[id]` (GET) | médio |
| `USE_POSTGRES_WALLET_DUAL_WRITE` | `selectWalletRepo` (dual-write) | `/api/me/wallet` (GET) | **alto** |
| `USE_POSTGRES_WALLET` | `selectWalletRepo` (postgres primary) | idem | **alto** |

---

## Sequência de rollout

### 1️⃣ Users — `USE_POSTGRES_USERS`

Caminho mais seguro (read-only, baixo volume).

```bash
# Canário:
FF_USE_POSTGRES_USERS_USERS=alexandre

# Validar:
# - GET /api/users como Alexandre retorna a mesma lista que via Redis.
# - Comparar response com curl + flag OFF (ou login como outro admin).
# - Latência p99 < 100ms.

# Após 24h:
FF_USE_POSTGRES_USERS=on

# Após 7 dias sem incidente:
# PR de consolidação remove RedisUserRepository e a flag.
```

**Rollback:** `FF_USE_POSTGRES_USERS=off` (Redis nunca foi tocado).

---

### 2️⃣ Workspaces — `USE_POSTGRES_WORKSPACES`

Mesma cadência. Volume ainda menor (workspaces são poucos).

---

### 3️⃣ Wallet — `USE_POSTGRES_WALLET_DUAL_WRITE` ⚠️

**FASE A — dual-write canário:**

```bash
FF_USE_POSTGRES_WALLET_DUAL_WRITE_USERS=alexandre

# Validar:
# - Top-up + spend rodando como Alexandre escreve em AMBOS Redis e Postgres.
# - GET /api/me/wallet ainda lê do Redis (primary).
# - Sentry mostra zero events tag=feature:wallet_dual_write (nenhuma
#   divergência silenciosa do shadow).
```

Rodar reconciliation diariamente (agendar via Vercel Cron):
```bash
npx tsx scripts/reconcile/wallets.ts
# Esperado: walletsRead == walletsWritten, zero divergência.
```

**FASE B — dual-write global:**

```bash
FF_USE_POSTGRES_WALLET_DUAL_WRITE=on
# Continua lendo de Redis. Postgres recebe sombra de TODAS as wallets.
```

Após **30 dias** com 0 divergências em reconciliation:

**FASE C — flip primary:**

```bash
FF_USE_POSTGRES_WALLET=on
# Lê de Postgres. Redis vira shadow (escrita continua nos dois).
```

**Rollback (qualquer fase):**
```bash
FF_USE_POSTGRES_WALLET=off
FF_USE_POSTGRES_WALLET_DUAL_WRITE=off
# Redis nunca foi tocado — operação é instantânea.
```

---

## Observabilidade (M3-PR6 + M4-PR5)

- **Sentry** (`SENTRY_DSN`) captura erros server-side. Tags úteis:
  - `feature: wallet_dual_write` — divergência silenciosa do shadow.
  - `feature: video_generation` — falhas no Inngest.
  - `feature: jobs` — erros de polling.
- **PostHog** (`NEXT_PUBLIC_POSTHOG_KEY`) — analytics frontend.
  Wiring por feature ainda pendente (cada call site `track(...)`
  deve ser adicionado pela própria UI).

---

## Wiring restante (não coberto por M4)

Wires futuros, em ordem de valor → risco:

- `/api/admin/organizations` — list (workspaces)
- `/api/projects/*` — depende de RedisProjectRepository (a criar)
- `/api/episodes/*` — depende de RedisEpisodeRepository (a criar)
- Writes de `/api/users` (POST/PATCH) — dual-write opcional
- `/api/generate` spendCredits — wallet operations no caminho de
  geração, depois que dual-write da wallet estiver consolidado

---

## Sumário visual

```
[deploy M4-PR1..7]
      │
      ▼
[backfill users + wallets via scripts/backfill/]
      │
      ▼
[Users canário → global (7 dias)]
      │
      ▼
[Workspaces canário → global (7 dias)]
      │
      ▼
[Wallet dual-write canário → global (7 dias)]
      │
      ▼
[Wallet dual-write rodando 30 dias com reconcile=0 divergência]
      │
      ▼
[Wallet flip Postgres primary]
      │
      ▼
[Após 30 dias sem incidente]
      │
      ▼
[PR consolidação remove caminhos Redis legados]
```

Tempo realista: **8-12 semanas** do deploy à consolidação Postgres
do Wallet.
