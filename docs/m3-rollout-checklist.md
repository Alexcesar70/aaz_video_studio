# Milestone 3 — Rollout Checklist (Postgres + Drizzle)

> Plano de migração Redis → Postgres por entidade, executado em
> ordem de risco crescente. Cada entidade tem 4 fases:
> **(1) deploy schema** → **(2) backfill** → **(3) dual-write/dual-read** → **(4) consolidação**.
>
> Princípio: nenhuma entidade migra sem a anterior estabilizada.
> Wallet (a mais arriscada) só depois de Users + Workspaces estarem
> 100% em Postgres há pelo menos 7 dias sem incidente.

---

## Pré-requisitos antes de qualquer flag

1. ✅ **Postgres provisionado** — Neon, Supabase, Vercel Postgres, etc.
2. ✅ **DATABASE_URL setado** na Vercel (production + preview).
3. ✅ **Migrations aplicadas** em produção:
   ```bash
   npm run db:migrate
   ```
   Drizzle aplica `drizzle/0000_*.sql` e qualquer subsequente.
4. ✅ **Backup do Redis** — `redis-cli --rdb dump.rdb` (ou exportar
   via dashboard do Upstash) antes de qualquer dual-write.
5. ✅ **Sentry DSN** configurado (M3-PR6) para visibilidade de erros
   durante a migração — vital pra detectar divergências cedo.

---

## Flags do M3 (todas a serem criadas no rollout)

| Flag | Entidade | PR | Risco |
|---|---|---|---|
| `USE_POSTGRES_USERS` | User | M3-PR2 + wiring | médio |
| `USE_POSTGRES_WORKSPACES` | Workspace | M3-PR3 + wiring | médio |
| `USE_POSTGRES_PROJECTS` | Project | M3-PR4 + wiring | baixo |
| `USE_POSTGRES_EPISODES` | Episode | M3-PR4 + wiring | baixo |
| `USE_POSTGRES_WALLET` | Wallet/Txn | M3-PR5 + wiring | **ALTO** (dinheiro) |

> **Importante:** os PRs M3-PR2..PR5 entregaram apenas a **camada de
> persistência Postgres** (ports + adapters + tests). O wiring nas
> rotas existentes é PR posterior — composição via flag.

---

## Ordem de rollout

### 1️⃣ Backfill inicial (rodar 1x por entidade, idempotente)

Antes de ligar dual-write/dual-read, copia tudo do Redis para
Postgres. Os scripts ficam em `scripts/backfill/`. Cada um lê o
Redis, mapeia para o domínio, e usa `upsert()` do adapter Postgres.

```bash
# Como super_admin, com DATABASE_URL e REDIS_URL setados:
npx tsx scripts/backfill/users.ts        # → ~50 users
npx tsx scripts/backfill/workspaces.ts   # → ~10 workspaces
npx tsx scripts/backfill/projects.ts
npx tsx scripts/backfill/episodes.ts
npx tsx scripts/backfill/wallets.ts      # ⚠️ por último, mais delicado
```

Ao final, validar contagens:
```sql
SELECT count(*) FROM users;
SELECT count(*) FROM workspaces;
SELECT count(*) FROM wallets;
SELECT sum(balance_usd) FROM wallets;  -- deve bater com total no Redis
```

### 2️⃣ Users — `USE_POSTGRES_USERS`

**Por que primeiro:** menos arriscado (read-mostly), serve de
canário pra validar conectividade Postgres + latência em produção.

```bash
# Canário: só Alexandre lê do Postgres
FF_USE_POSTGRES_USERS_USERS=alexandre

# Validar:
# - Login do Alexandre funciona; /api/auth/me retorna user idêntico ao Redis.
# - Audit: rodar query Postgres vs Redis pra mesma linha, comparar shapes.
# - Latência: p99 < 100ms pra findById.

# Após 24h sem incidente:
FF_USE_POSTGRES_USERS=on  # global
# Após 7 dias sem incidente:
# - PR de consolidação remove RedisUserRepository e dual-write.
```

### 3️⃣ Workspaces — `USE_POSTGRES_WORKSPACES`

Mesma cadência. Workspaces tem ainda menos volume — risco é só de
deploy quebrar lookup por slug.

### 4️⃣ Projects + Episodes (paralelo) — `USE_POSTGRES_PROJECTS`, `USE_POSTGRES_EPISODES`

Podem migrar em paralelo. Volume baixo, sem dependência circular.

### 5️⃣ Wallet — `USE_POSTGRES_WALLET` ⚠️ **DINHEIRO**

**Etapa adicional obrigatória: dual-write antes de dual-read.**

```bash
# Fase A — dual-write (toda escrita vai para AMBOS):
FF_USE_POSTGRES_WALLET_DUAL_WRITE=on
# Continua lendo de Redis. Postgres recebe sombra das operações.
# Validar diariamente via reconciliation script:
npx tsx scripts/reconcile/wallets.ts
# Esperado: divergências = 0.

# Fase B — dual-read após 7 dias com 0 divergências:
FF_USE_POSTGRES_WALLET=on   # ler de Postgres
# Continua escrevendo nos dois (safety net).

# Fase C — consolidação após 30 dias sem incidente:
# PR remove dual-write. Redis wallet keys ficam read-only legacy.
# Após 30 dias sem touch, expurgar.
```

**Rollback do Wallet (qualquer fase):**
```bash
FF_USE_POSTGRES_WALLET=off            # volta a ler de Redis
FF_USE_POSTGRES_WALLET_DUAL_WRITE=off # para de escrever no Postgres
# Redis nunca foi tocado — operação é instantânea.
```

---

## Reconciliation scripts (`scripts/reconcile/`)

Job noturno (Vercel Cron ou GitHub Action) que compara contagens e
sums entre Redis e Postgres durante o dual-write. Divergência > 0
emite alerta via `reportError`.

```typescript
// scripts/reconcile/wallets.ts (esqueleto)
import { getRedis } from '@/lib/redis'
import { getDb } from '@/db/client'
import { wallets } from '@/db/schema'

const redis = await getRedis()
const db = getDb()

const redisKeys = await redis.keys('aaz:wallet:*')
const pgRows = await db.select().from(wallets)

if (redisKeys.length !== pgRows.length) {
  // reportError(...)
}
// + sum(balance_usd) compare
```

---

## Métricas a monitorar

Durante o rollout, ficar de olho em:

- **Latência p50/p99** das rotas que tocam cada entidade (Vercel
  Analytics + nossos próprios timestamps em activity events).
- **Taxa de erro** em /api/auth/me, /api/me/wallet, /api/generate
  (Sentry dashboard).
- **Connection pool** do Postgres — `SELECT count(*) FROM pg_stat_activity`
  durante picos.
- **Saldo total** em wallets — `SUM(balance_usd)` deve permanecer
  estável (ou crescer só por top-ups conhecidos).

---

## Sumário visual

```
[deploy M3-PR1..7]
      │
      ▼
[provisionar Postgres + DATABASE_URL + Sentry]
      │
      ▼
[npm run db:migrate]
      │
      ▼
[backfill scripts (idempotente, por entidade)]
      │
      ▼
[Users → Workspaces → Projects/Episodes  (canário → global, 7d cada)]
      │
      ▼
[Wallet — dual-write → reconcile → dual-read → consolidação]
      │
      ▼
[Após 30d sem incidente]
      │
      ▼
[PRs de consolidação por entidade — remove caminho Redis legado]
```

Tempo total realista: **8-12 semanas** do deploy à consolidação
final do Wallet.
