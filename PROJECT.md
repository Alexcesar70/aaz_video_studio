# PROJECT.md — Creative Studio (Universal)

> **Bíblia do produto.** Documento canônico de visão, arquitetura e
> domínio. Independente de universo narrativo. Quem está entrando no
> projeto deve começar aqui — depois ler `CLAUDE.md` para regras
> operacionais e `docs/adr/` para decisões estruturantes.

---

## 1. O que é

**Creative Studio** é um SaaS de produção audiovisual com IA, dirigido a
**criadores individuais** e **equipes criativas pequenas**. Combina três
capacidades em uma plataforma única:

1. **Orquestração multi-engine de geração com IA** (vídeo, imagem, voz,
   música) com transparência total de custo.
2. **Sistema vivo de consistência visual** — personagens, estilos e
   referências como ativos reutilizáveis, não como prompts descartáveis.
3. **Workspace colaborativo** com governança de orçamento, papéis e
   bibliotecas compartilhadas.

A tese é simples: **cada geração soma**. Personagens, decisões criativas
e estilo se acumulam como capital reutilizável, não como custo perdido.

## 2. Para quem

- **Creator solo profissional** — produtor de conteúdo, animador indie,
  educador audiovisual, freelancer de branding.
- **Times criativos pequenos (3–15 pessoas)** — studios boutique, agências
  pequenas, produtoras de conteúdo educacional/infantil, creators com squad.

## 3. Posicionamento

Categoria: **AI Creative Studio with Visual Memory**.

Diferenciação frente a `Higgsfield` / `Runway` / `Krea`:

- **Memory-first.** Consistência é estrutura de dados (Character,
  StyleProfile, ReferenceAsset), não prompt engineering.
- **Engine-agnóstico.** Ninguém é casado com Seedance ou Veo — o
  Orchestrator roteia pelo melhor por caso de uso, com margem
  transparente.
- **Custo previsível.** Wallet com saldo real, custo capturado pelo
  saldo-antes/saldo-depois do provider, margem visível ao admin.
- **Colaboração nativa.** Bibliotecas compartilháveis, RBAC, budgets
  por usuário.

## 4. Princípios de produto

1. **Memory over Magic.** Toda feature pergunta: *isso acumula valor reusável?*
2. **Transparência sobre Delighter.** Custo visível antes e depois.
3. **Fluxo criativo não-bloqueante.** Auto-save, undo barato.
4. **Consistência > Customização prematura.**
5. **Colaboração é default, não feature.**
6. **Agnosticismo de provider.** UI nunca conhece nome de engine proprietária.
7. **Domínio protegido.** Regras em `domain/` + `usecases/`. Nunca em rotas HTTP ou React.
8. **Escalabilidade sem overengineering.** Modular, mas monolito ainda.

## 5. Domínio — Bounded contexts

```
┌─────────────────────────────────────────────────────────────┐
│                      PLATFORM BOUNDARY                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌─────────────────┐    ┌────────────┐  │
│  │   Identity   │───▶│   Workspace     │───▶│ Collabora- │  │
│  │   & Access   │    │   Management    │    │    tion    │  │
│  └──────────────┘    └─────────────────┘    └────────────┘  │
│         │                     │                    │         │
│         ▼                     ▼                    ▼         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            CREATIVE CORE (domain protected)          │    │
│  │  ┌──────────┐  ┌────────────┐  ┌───────────────┐   │    │
│  │  │ Creative │  │   Project  │  │   Generation  │   │    │
│  │  │ Library  │  │ Production │  │ Orchestration │   │    │
│  │  └──────────┘  └────────────┘  └───────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│                              │                               │
│                              ▼                               │
│  ┌──────────────┐    ┌─────────────────┐    ┌────────────┐  │
│  │   Billing    │    │  Observability  │    │    Ops     │  │
│  │   & Wallet   │    │   & Analytics   │    │  (Admin)   │  │
│  └──────────────┘    └─────────────────┘    └────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

| Contexto | Responsabilidade | Estado em M1 |
|---|---|---|
| **Identity & Access** | Auth, sessões, credenciais | `src/lib/users.ts`, `src/lib/auth.ts` (legado) |
| **Workspace Management** | Tenants, membership, settings | `src/modules/workspaces` + `src/lib/organizations.ts` |
| **Collaboration** | Permissões efetivas, policies | `src/lib/permissions.ts` (RBAC parcial) |
| **Creative Library** | Characters, StyleProfiles, References | `src/modules/library` (parcial) + `src/lib/assets.ts` |
| **Project Production** | Projects, Scenes, Sequences | `src/lib/scenes.ts`, episodes, projects (legado) |
| **Generation Orchestration** | Request → Job → Output | `src/app/api/generate*` + `src/usecases/video` |
| **Prompts** | Director templates, composers | `src/modules/prompts` (completo) |
| **Billing & Wallet** | Saldo, planos, pricing, margem | `src/lib/wallet.ts`, `pricing.ts`, `plans.ts` |
| **Analytics** | Event stream, daily aggregates | `src/lib/activity.ts` |
| **Admin / Backoffice** | Console super_admin | `src/components/SuperAdmin.tsx` |

## 6. Modelos centrais

- **Workspace** — unidade de tenancy. Tipo `individual` (maxUsers=1) ou
  `team` (maxUsers ≥ 2). Toda criação pertence a UM workspace.
- **User** — identidade global. Pertence a 1 workspace em M1; N em M2 via
  Membership.
- **Character** — ativo reutilizável de personagem. Workspace-scoped.
- **StyleProfile** — receita visual reutilizável. Globais (presets) ou
  por workspace (custom/forks).
- **PromptTemplate** — system prompt persistido para os Directors.
- **GenerationJob** — execução de uma geração. Inclui custo real, output URL.
- **Wallet** — saldo do workspace. Hard-block em geração se balance < 0.

## 7. RBAC inicial

5 roles canônicos dentro do workspace:

| Role | Cria | Edita | Publica biblioteca | Convida | Billing |
|---|---|---|---|---|---|
| **Owner** | ✅ tudo | ✅ tudo | ✅ | ✅ | ✅ |
| **Team Leader** | ✅ | ✅ | ✅ | ✅ (até Editor) | ❌ |
| **Editor** | ✅ | ✅ próprio | ❌ (sugere) | ❌ | ❌ |
| **Collaborator** | ❌ | só atribuídos | ❌ | ❌ | ❌ |
| **Viewer** | ❌ | ❌ | ❌ | ❌ | ❌ |

`super_admin` é global (fora do workspace) — vê o painel `/admin`.

## 8. Stack técnica atual

| Camada | Atual (M1) | Planejado (M2+) |
|---|---|---|
| Front-end | Next.js 14 + React + Tailwind | + componentização (decompor `AAZStudio.tsx`) |
| Back-end | Next.js API Routes | + workers Inngest para gerações longas |
| Banco | Redis (Vercel KV) | + Postgres (Drizzle) para entidades transacionais |
| Storage | Vercel Blob | manter |
| Cache / Sessions / Activity | Redis | manter |
| Auth | JWT caseiro | NextAuth/Clerk |
| Billing | Wallet caseiro + recargas manuais | + Stripe gateway |
| Observabilidade | Logs console | + Sentry + Axiom + PostHog |
| Tests | Vitest + Playwright | + integration tests |
| IA / Orchestration | Adapter pattern (`src/providers/`) | Engine Registry com fallback automático |

## 9. Estrutura de pastas

```
src/
├── shared/               (futuro — value objects, errors)
├── modules/              ← código novo, Clean Architecture
│   ├── prompts/          ✅ completo (M1)
│   ├── library/          ✅ parcial (characters seed + styleProfiles)
│   ├── workspaces/       ✅ parcial (use case + tipos + aliases)
│   ├── identity/         (futuro)
│   ├── collaboration/    (futuro)
│   ├── projects/         (futuro)
│   ├── orchestration/    (futuro)
│   └── billing/          (futuro)
├── lib/                  ← legado (read-only para código novo)
│   ├── users.ts
│   ├── organizations.ts  (deprecated em favor de @/modules/workspaces)
│   ├── wallet.ts
│   ├── pricing.ts
│   ├── assets.ts
│   ├── moods.ts
│   ├── sceneDirectorSystem.ts (composição extraída em PR #3)
│   ├── imageDirectorSystem.ts (legacy fallback p/ flag OFF)
│   └── ...
├── providers/            ← adapters externos
│   ├── segmind/
│   ├── anthropic/
│   ├── elevenlabs/
│   └── ...
└── app/                  ← Next.js (rotas + components)
    ├── api/
    ├── login/
    ├── studio/
    ├── admin/
    └── ...
```

## 10. Decisões formais (ADRs)

- [ADR-0001](./docs/adr/0001-module-structure.md) — Estrutura modular + Clean Architecture incremental.
- [ADR-0002](./docs/adr/0002-feature-flag-strategy.md) — Feature flags via env vars (sem staging).
- [ADR-0003](./docs/adr/0003-workspace-as-tenancy.md) — Workspace como tenancy; Individual = maxUsers=1.
- [ADR-0004](./docs/adr/0004-incremental-rename-org-to-workspace.md) — Rename Organization → Workspace incremental.

## 11. Status do refactor universal

**Milestone 1 — Agnostic Core (concluído):**
- Sistema independente do universo "AAZ com Jesus" via 4 feature flags.
- Módulos `prompts`, `library`, `workspaces` introduzidos seguindo Clean Architecture.
- 163+ testes unitários.
- AAZ continua funcionando 100% como fonte de seeds (clay-massinha,
  lead characters, prompt templates).

**Próximos milestones:**

- **M2 — Criação avançada:** Inngest, Postgres, Stripe, ReferenceAssets,
  Versioning de Library.
- **M3 — Colaboração e governança:** Invitations, custom policies, audit log.
- **M4 — Diferenciais e escala:** Playbooks, Brand Memory, Scene Packs.

## 12. Onde olhar primeiro

| Pergunta | Arquivo |
|---|---|
| Como começo? | Este `PROJECT.md` + `CLAUDE.md` |
| Como rodo? | `package.json` (`npm run dev`, `npm run test`) |
| Qual o roadmap atual? | `CLAUDE.md` seção "Roadmap" |
| Por que essa decisão? | `docs/adr/` |
| Como estão as flags? | `docs/m1-rollout-checklist.md` |
| Quero adicionar feature X | Veja qual módulo, leia `index.ts` dele |
| Quero entender geração | `src/app/api/generate*` + `src/usecases/video` |
| Quero entender billing | `src/lib/wallet.ts`, `pricing.ts` |
| Quero entender Auth | `src/middleware.ts`, `src/lib/auth.ts` |

---

**Convenção de commits:** `<type>(<escopo>): <descrição curta>`

```
feat(library): add referenceAsset entity
refactor(m2-pr3): postgres migration for users
fix(billing): wallet.spend race condition
test(prompts): cover image director with anime profile
docs(adr): ADR-0005 — Inngest as job runner
```

**Convenção de PRs:** stacked PRs durante refactors (PR #N+1 baseado em PR #N).
Default branch de integração: `universal` (M1+). `main` é freeze pré-refactor (`v0.0.1`).
