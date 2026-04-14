# CLAUDE.md — Instruções de trabalho

> Este arquivo é a **bíblia operacional** lida pelo Claude Code (e por
> qualquer dev) ao trabalhar neste repositório. Visão de produto e
> arquitetura completa estão em `PROJECT.md`. Decisões estruturantes
> em `docs/adr/`. Histórico de fases pré-refactor em `docs/history/`.

**Desenvolvedor:** Alexandre (solo)
**Branch ativo:** `universal` (M1 entregue) — `main` está congelado em `v0.0.1`.

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

### Milestone 2 — Próximo (escopo a ser detalhado)

Áreas previstas (ordem de prioridade):

1. **Postgres + Drizzle** para User, Workspace, Project, Wallet, Transaction.
2. **Inngest** para gerações longas (sai do timeout 300s da Vercel).
3. **ReferenceAsset** como entidade de primeira classe.
4. **Versionamento** de Character e StyleProfile.
5. **Sentry + Axiom + PostHog** para observabilidade real.

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

- `main` — freeze pré-refactor (tag `v0.0.1`).
- `universal` — branch de integração do refactor (default daqui em diante).
- `refactor/m{N}-pr{X}-<slug>` — sub-branch por PR, stacked sobre o anterior.
- `feat/<slug>` — features pós-M1.
- `fix/<slug>` — bug fixes.

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
