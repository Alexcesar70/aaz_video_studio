# Milestone 5 — Rollout Checklist

> M5 expande o wiring iniciado no M4 (Users + Workspaces + Wallet
> reads) para Projects, Episodes e wallet WRITES. Adiciona
> reconciliation job noturno e a foundation de Playbooks.

---

## Pré-requisitos

1. ✅ Tudo do `docs/m4-rollout-checklist.md`.
2. ✅ Backfill de Projects e Episodes (scripts a criar — template
   em `scripts/backfill/users.ts`).
3. ✅ `CRON_SECRET` setado na Vercel (auth do reconcile diário).

---

## Flags do M5

| Flag | Adapter | Rota wired | Risco |
|---|---|---|---|
| `USE_POSTGRES_PROJECTS` | `selectProjectRepo` | `/api/projects` (GET) | baixo |
| `USE_POSTGRES_EPISODES` | `selectEpisodeRepo` | `/api/episodes` (GET) | baixo |
| `PROMPT_PLAYBOOKS` | (UI gating) | UI futura | baixo |

> **Wallet writes (M5-PR3)** não introduz flag nova — usa as do
> M4-PR4 (`USE_POSTGRES_WALLET_DUAL_WRITE` + `USE_POSTGRES_WALLET`).
> Quando dual-write está on, top-ups e spends agora refletem nos
> dois stores.

---

## Sequência de rollout

### 1️⃣ Projects + Episodes (paralelo)

Volume baixo, dependências simples. Pode ligar os dois no mesmo dia.

```bash
# Canário (Alexandre):
FF_USE_POSTGRES_PROJECTS_USERS=alexandre
FF_USE_POSTGRES_EPISODES_USERS=alexandre

# Validar:
# - GET /api/projects e /api/episodes retornam mesma lista.
# - Aba Histórico do Studio carrega projects + episodes corretamente.
# - Latência p99 < 100ms.

# Após 24h:
FF_USE_POSTGRES_PROJECTS=on
FF_USE_POSTGRES_EPISODES=on
```

**Edge case legacy data:** itens sem `organizationId` no Redis
ficam visíveis via sentinel `__legacy__` (ver
`RedisProjectRepository`). Postgres não tem esse caminho — backfill
deve assignar orphans à org correta antes do flip. Se houver
muitos orphans, criar um one-off:

```sql
-- Inspecionar orphans no Redis após dump (não é direto via Postgres):
-- conferir scripts/backfill/projects.ts (a criar) e episodes.ts
```

### 2️⃣ Wallet writes via dual-write

Já gated pelas flags do M4. M5-PR3 wiring entra em efeito automaticamente
quando dual-write estiver on.

```bash
# Já feito no M4-PR4:
FF_USE_POSTGRES_WALLET_DUAL_WRITE=on

# Agora top-ups + spends de generateVideo escrevem em ambos
# stores. Reconcile diário (cron já registrado em vercel.json).
```

Validação: ver report do cron diariamente:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://aaz-video-studio.vercel.app/api/cron/reconcile-wallets
# Esperado: missing_in_postgres=[], missing_in_redis=[], balance_diffs=[].
```

Se houver divergência, Sentry recebe event com fingerprint
`['wallet-reconcile', 'divergence']` — agrupa todas no mesmo issue.

### 3️⃣ Playbooks (foundation only neste M5)

Flag `PROMPT_PLAYBOOKS` continua OFF. M5-PR5 só introduz o
módulo + Redis adapter + use cases. UI virá em milestone futuro.

Quando for ligar:
1. Implementar UI (PlaybookEditor + PlaybookSelector no Studio).
2. Wire `applyPlaybook(activePlaybook)` no fluxo de geração:
   - `styleProfileSlug` substitui o style padrão.
   - `characterSlugs` filtram o picker.
   - `promptOverrides` viram override por workspace no
     `getPromptTemplate(slug, workspaceId)` (já suportado pelo
     módulo prompts desde M1).
   - `defaults` populam form fields iniciais.

---

## Wiring restante (não coberto por M5)

- `/api/admin/organizations` GET (list workspaces) — wire ao composer.
- Writes de Projects/Episodes — POST/DELETE de `/api/projects/[id]`
  e `/api/episodes/[id]`.
- AAZStudio decomposição: AdminPanel + AtelierTab (próximas tabs
  candidatas a extração — após HistoryTab no M5-PR6).
- PostHog wiring por feature (track de signup, generation,
  publication, etc.).

---

## Sumário visual

```
[deploy M5-PR1..7]
      │
      ▼
[Vercel cron auto-detecta vercel.json — reconcile diário começa]
      │
      ▼
[Wallet dual-write captura top-ups e spends em dois stores]
      │
      ▼
[Projects + Episodes canário → global (paralelo, 7 dias)]
      │
      ▼
[Reconcile rodando 30 dias com 0 divergências]
      │
      ▼
[Wallet flip: USE_POSTGRES_WALLET=on (Postgres primary)]
      │
      ▼
[Após 30 dias estáveis com Postgres primary]
      │
      ▼
[PR de consolidação remove Redis adapters e flags]
```

Tempo realista total (M3+M4+M5 → consolidação Postgres): **3-4 meses**.
