# CLAUDE.md — Instruções de trabalho

> Este arquivo é a **bíblia operacional** lida pelo Claude Code (e por
> qualquer dev) ao trabalhar neste repositório. Visão de produto e
> arquitetura completa estão em `PROJECT.md`. Decisões estruturantes
> em `docs/adr/`. Histórico de fases pré-refactor em `docs/history/`.

**Desenvolvedor:** Alexandre (solo)
**Branch ativa:** `main` — recebe o refactor M1-M6 via merge (commit `3ddf7cc`).
**Snapshot pré-refactor:** tag imutável [`v0.0.1`](https://github.com/Alexcesar70/aaz_video_studio/releases/tag/v0.0.1) — AAZ Studio "com Jesus" original, recuperável a qualquer momento via `git checkout v0.0.1`.

---

## Regras do refactor universal (vale para todo PR pós-M1)

1. **Paridade funcional obrigatória.** Nenhum PR pode regredir fluxo
   existente sem feature flag.
2. **Feature flags em tudo que é risco.** Default OFF. Liga primeiro
   para o próprio dono via `FF_{FLAG}_USERS=<userId>`, depois canário,
   depois global. Sistema em `src/lib/featureFlags.ts`. Ver
   [ADR-0002](./docs/adr/0002-feature-flag-strategy.md).
3. **PRs pequenos (< 400 linhas).** Se estoura, quebra em dois.
4. **Sem migração big bang.** Redis continua até M2 (Postgres).
5. **Estrutura modular em Clean Arch.** Código novo vai para
   `src/modules/<contexto>/` seguindo `domain/ usecases/ ports/ infra/`.
   `src/lib/` é read-only para código novo. Ver
   [ADR-0001](./docs/adr/0001-module-structure.md).
6. **Toda decisão estruturante vira ADR** em `docs/adr/`.
7. **Testes antes do refactor.** Vitest unit + Playwright smoke rodam
   antes de qualquer mudança em rota crítica.
8. **Workspace, não Organization.** Código novo importa de
   `@/modules/workspaces`. Legado fica até ser tocado por outro motivo.
   Ver [ADR-0004](./docs/adr/0004-incremental-rename-org-to-workspace.md).

---

## Comandos

```bash
npm run dev            # Dev server → http://localhost:3000
npm run build          # Build de produção
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint

npm run test           # Vitest — unitários do domínio
npm run test:watch     # Vitest watch
npm run test:e2e       # Playwright — smoke (requer dev server + env vars)
npm run test:e2e:ui    # Playwright interativo
```

### Variáveis de ambiente para E2E

```bash
# .env.test ou exportar no shell
E2E_BASE_URL=http://localhost:3000
E2E_ADMIN_EMAIL=...
E2E_ADMIN_PASSWORD=...
E2E_CREATOR_EMAIL=...         # opcional
E2E_CREATOR_PASSWORD=...      # opcional
```

### Variáveis de ambiente de produto

Documentadas no `README.md` (Auth, Segmind, Anthropic, Suno, ElevenLabs,
Vercel KV, Vercel Blob).

---

## Roadmap

### Milestone 1 — Agnostic Core ✅ COMPLETO

- [x] **PR #1** — Guardrails (Vitest + Playwright + feature flags + ADRs)
- [x] **PR #2** — Módulo `prompts` + `PromptTemplate` entity (seed via `POST /api/admin/prompts/seed`)
- [x] **PR #3** — Directors leem do repositório (flag `USE_DB_PROMPTS`, paridade validada)
- [x] **PR #4** — Characters migrados para registros de DB (flag `USE_DB_ONLY_CHARACTERS`, seed em `POST /api/admin/characters/seed`)
- [x] **PR #5** — `StyleProfile` como entidade de primeira classe (6 presets globais)
- [x] **PR #6** — Image Director usa StyleProfile (flag `USE_STYLE_PROFILES`) + `GET /api/style-profiles` público + Moods decouple
- [x] **PR #7** — Signup wizard + Workspace creation (flag `NEW_SIGNUP_WIZARD`; `POST /api/workspaces`; ADR-0003)
- [x] **PR #8** — Rename semântico Organization → Workspace (type aliases; `AuthUser.workspaceId`; ADR-0004)
- [x] **PR #9** — Consolidação + `PROJECT.md` universal

**Plano de rollout das 4 feature flags do M1:** ver
[`docs/m1-rollout-checklist.md`](./docs/m1-rollout-checklist.md).

### Milestone 2 — Async generation + library entities ✅ COMPLETO

- [x] **M2-PR1** — Jobs module foundation (domain + Redis/InMemory adapters)
- [x] **M2-PR2** — Inngest adapter + `/api/generate` async (flag `USE_ASYNC_GENERATION`)
- [x] **M2-PR3** — `ReferenceAsset` como entidade (`@/modules/references`)
- [x] **M2-PR4** — Asset Picker + auto-register no upload (flag `USE_REFERENCE_ASSETS`)
- [x] **M2-PR5** — `Character` como entidade + versionamento + histórico
- [x] **M2-PR6** — `StyleProfile` versionamento (admin route `/api/admin/style-profiles/[slug]/versions`)
- [x] **M2-PR7** — Decomposição inicial de `AAZStudio.tsx` (theme, types, atoms, modals)
- [x] **M2-PR8** — `errorReporter` abstrato + ADR-0005

**Rollout:** ver [`docs/m2-rollout-checklist.md`](./docs/m2-rollout-checklist.md).

### Milestone 3 — Postgres + observability ✅ CODE-COMPLETE

- [x] **M3-PR1** — Drizzle setup + schemas + migrations iniciais (ADR-0006)
- [x] **M3-PR2** — `users` module (Postgres adapter + InMemory + usecases)
- [x] **M3-PR3** — `workspaces` Postgres adapter
- [x] **M3-PR4** — `projects` + `episodes` modules
- [x] **M3-PR5** — `wallet` + transactions ACID (Postgres `db.transaction()` + row lock)
- [x] **M3-PR6** — Sentry adapter (concretiza `ErrorReporter` do M2-PR8)
- [x] **M3-PR7** — Consolidação: backfill scripts + rollout checklist

**Rollout:** ver [`docs/m3-rollout-checklist.md`](./docs/m3-rollout-checklist.md).
Backfill scripts em `scripts/backfill/`.

### Milestone 4 — Wiring + Observability + Decomposition ✅ CODE-COMPLETE

- [x] **M4-PR1** — `RedisUserRepository` + `selectUserRepo` + lazy DB resolution
- [x] **M4-PR2** — Wire `/api/users` (GET) ao composer (flag `USE_POSTGRES_USERS`)
- [x] **M4-PR3** — `RedisWorkspaceRepository` + `selectWorkspaceRepo` + wire `/api/admin/organizations/[id]` (GET)
- [x] **M4-PR4** — `RedisWalletRepository` + `DualWriteWalletRepository` + `selectWalletRepo` + wire `/api/me/wallet` (GET) — flags `USE_POSTGRES_WALLET` e `USE_POSTGRES_WALLET_DUAL_WRITE`
- [x] **M4-PR5** — `analytics` abstraction + PostHog adapter
- [x] **M4-PR6** — Decomposição contínua de `AAZStudio.tsx` (KpiCard, NewUserCredsModal)
- [x] **M4-PR7** — Consolidação: `docs/m4-rollout-checklist.md` + CLAUDE.md update

**Rollout:** ver [`docs/m4-rollout-checklist.md`](./docs/m4-rollout-checklist.md).

### Milestone 5 — Wiring expansion + Playbooks ✅ CODE-COMPLETE

- [x] **M5-PR1** — `RedisProjectRepository` + `RedisEpisodeRepository` + composers (flags `USE_POSTGRES_PROJECTS`, `USE_POSTGRES_EPISODES`)
- [x] **M5-PR2** — Wire `/api/projects` + `/api/episodes` (GET) ao composer com fallback de legacy data via sentinel `__legacy__`
- [x] **M5-PR3** — Wire wallet writes: admin `add_credits` + `generateVideo` spend via `composedSpendCredits` (helper em `src/lib/walletWiring.ts`)
- [x] **M5-PR4** — Wallet reconciliation script + Vercel Cron diário (`/api/cron/reconcile-wallets`)
- [x] **M5-PR5** — Módulo `playbooks` (entidade + Redis/InMemory + use cases + versionamento + clone)
- [x] **M5-PR6** — Decomposição `AAZStudio.tsx`: extrai `HistoryTab` + `SceneCard` + `EpisodeHeader` + `EpisodeDeliveryCard` (-285 linhas)
- [x] **M5-PR7** — Consolidação: ADR-0007 (composer pattern) + `docs/m5-rollout-checklist.md` + CLAUDE.md

**Rollout:** ver [`docs/m5-rollout-checklist.md`](./docs/m5-rollout-checklist.md).
**Padrão de migração:** ver [ADR-0007](./docs/adr/0007-composer-pattern-for-storage-migration.md).

### Milestone 6 — Notifications + Webhooks ✅ CODE-COMPLETE

- [x] **M6-PR1** — Backfill scripts: workspaces + projects + episodes (com sentinel `__legacy__` resolution via createdBy.organizationId)
- [x] **M6-PR2** — Módulo `notifications` foundation (12 kinds, 3 levels, Redis layout otimizado)
- [x] **M6-PR3** — Email channel: `EmailNotificationSender` + `ResendEmailDeliverer` + Inngest fan-out function
- [x] **M6-PR4** — Wire em pontos críticos: `wallet_topped_up`, `episode_approved`/`needs_changes`, `job_failed`
- [x] **M6-PR5** — Outbound webhooks HMAC-signed (módulo `webhooks` + `WebhookNotificationSender` + auto-pause em falhas)
- [x] **M6-PR6** — Decomposição: extrai `InviteUserModal` (-117 linhas)
- [x] **M6-PR7** — Consolidação: ADR-0008 (event-driven notifications) + `docs/m6-rollout-checklist.md` + CLAUDE.md

**Rollout:** ver [`docs/m6-rollout-checklist.md`](./docs/m6-rollout-checklist.md).
**Arquitetura:** ver [ADR-0008](./docs/adr/0008-event-driven-notifications.md).

### Milestone 7 — UI Refactor + Creators ✅ CODE-COMPLETE

- [x] **M7-PR1** — Route group `(workspace)` + Workspace Home dashboard
- [x] **M7-PR2** — Sidebar nav + 8 páginas (projects, assets, music, voices, spaces, team, settings, profile)
- [x] **M7-PR3** — Remove header duplicado + simplifica tabs do AAZStudio
- [x] **M7-PR4** — Remove código morto (Library + Admin tabs, -327 linhas)
- [x] **M7-PR5** — Extrai SenoidePanel + CantigasWizard pra arquivos próprios (-1440 linhas)
- [x] **M7-PR6** — Aba Creators (YouTube/TikTok/Instagram) + Spielberg integrado (Claude API)
- [x] **M7-PR7** — Seletor de duração pra YouTube longo
- [x] **M7-PR8** — Fix build: WorkspaceContext movido pra lib/
- [x] **M7-PR9** — Consolidação de 6 feature flags (global ON, -170 linhas legacy)
- [x] **M7-PR10** — Fix frontend leads (derivados da API, não hardcoded)
- [x] **M7-PR11** — Fix library leak + backfill prefix aaz:char:

**Tag:** `v0.2.0` — snapshot pré-refactor UI.

### Milestone 8 — Timeline + Creators Expansion (PLANEJADO)

- [ ] **M8-PR1** — Preview Episódio: variante Cinema (player + strip de cenas)
- [ ] **M8-PR2** — Preview Episódio: variante Storyboard (grid de cards)
- [ ] **M8-PR3** — Preview Episódio: variante Timeline (duração proporcional + playhead)
- [ ] **M8-PR4** — Sequenciador Nível 1: reordenar cenas (drag-and-drop) + export MP4 concatenado
- [ ] **M8-PR5** — Sequenciador Nível 2: transições entre cenas (fade, cut, dissolve)
- [ ] **M8-PR6** — Sequenciador Nível 2: faixa de áudio (trilha + TTS sincronizado)
- [ ] **M8-PR7** — Sequenciador Nível 2: trim básico (cortar início/fim de cena)
- [ ] **M8-PR8** — YouTube API: OAuth2 connect + channel info
- [ ] **M8-PR9** — YouTube API: analytics básico (views, retenção, top vídeos)
- [ ] **M8-PR10** — YouTube API: publicação direta
- [ ] **M8-PR11** — Creators: templates por nicho (educação, lifestyle, tech, fitness)
- [ ] **M8-PR12** — Creators: Spielberg sugere conteúdo baseado em analytics do canal

**Conceito Timeline:**
- Nível 1 (Sequenciador): organiza cenas na ordem, player sequencial, export
  concatenado. NÃO é editor de vídeo — é organizador de sequência.
- Nível 2 (Transições + Áudio): adiciona transições entre cenas (fade/cut/dissolve),
  faixa de áudio (música/TTS), trim básico. Diferenciador competitivo.
- Nível 3 (Editor completo tipo CapCut/Premiere): NÃO faremos. Exporta MP4 e
  o creator usa editor externo se quiser pós-produção pesada.

---

## Checklist de paridade funcional (rodar antes de cada merge)

- [ ] Login admin (Alexandre) funciona
- [ ] Login creator existente funciona
- [ ] Gerar vídeo Seedance com personagem AAZ → output clay, consistente
- [ ] Gerar imagem Nano Banana → output AAZ style
- [ ] Scene Director retorna PT/ES/EN válidos
- [ ] Criar scene, salvar, listar no histórico
- [ ] Wallet deduz valor correto
- [ ] Admin dashboard carrega KPIs
- [ ] `npm run typecheck` limpo
- [ ] `npm run test` passa 100%

---

## Convenções

### Imports

```typescript
// Domínio novo
import type { Workspace, StyleProfile } from '@/modules/workspaces' // / library
import { resolveSceneDirectorSystem } from '@/modules/prompts'

// Legado (até PR oportunístico migrar)
import { spendCredits } from '@/lib/wallet'
import { emitEvent } from '@/lib/activity'
```

### Commits

```
<type>(<escopo>): <descrição curta>

[contexto opcional explicando o "porquê"]

[lista opcional de mudanças notáveis]

[caminho de rollout / como ligar feature flag, se aplicável]
```

Tipos: `feat`, `refactor`, `fix`, `chore`, `docs`, `test`, `perf`.

### Branches

- `main` — branch de deploy (Vercel auto-deploy). Recebe todo refactor pós-M1.
- Tag `v0.0.1` — snapshot imutável do AAZ pré-refactor. Preservado por design
  do git (tags são imutáveis, sobrevivem a qualquer merge/reset na branch).
  Recuperação: `git checkout v0.0.1` ou `git branch <nome> v0.0.1`.
- `refactor/m{N}-pr{X}-<slug>` — sub-branch por PR, stacked sobre `main`.
- `feat/<slug>` — features pós-M1.
- `fix/<slug>` — bug fixes.
- `claude/<slug>` — sessões de trabalho do Claude Code.

> **Nota histórica:** até o commit `3ddf7cc Merge M2+M3+M4+M5+M6`, o fluxo
> previa `main` congelado em `v0.0.1` e `universal` como branch de
> integração. Essa separação foi descontinuada porque a tag `v0.0.1` já
> cumpre o papel de safety net (sem exigir branch paralela), e ter uma
> branch única simplifica o deploy. O universo AAZ original continua
> preservado — ver seção abaixo.

---

## Universo AAZ (legado preservado)

O AAZ Studio continua funcionando como **um tenant configurado** do
Creative Studio universal. Personagens canônicos, system prompts e
estética clay vivem agora em **seeds** dentro dos módulos:

- `src/modules/library/seeds/aazLeadCharacters.ts` — 7 personagens
- `src/modules/library/styleProfiles/usecases/seedDefaultStyleProfiles.ts` — preset `clay-massinha`
- `src/modules/prompts/usecases/seedDefaultTemplates.ts` — Scene/Lyrics/Storyboard Directors
- `src/lib/imageDirectorSystem.ts` (legacy fallback) — `AAZ_STYLE_BLOCK`
- `src/lib/sceneDirectorSystem.ts` (legacy fallback) — `SCENE_DIRECTOR_BASE`

Com as 4 flags ativas, esses seeds materializam o universo AAZ
identicamente ao pré-refactor — mas ele é AGORA **um tenant entre
muitos**, não a única opção.

---

**Para entender o produto inteiro, leia `PROJECT.md`.**
**Para decisões estruturais, leia `docs/adr/`.**
**Para histórico das fases pré-refactor, leia `docs/history/AAZ_STUDIO_PRE_REFACTOR.md`.**
