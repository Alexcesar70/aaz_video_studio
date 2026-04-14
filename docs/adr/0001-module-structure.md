# ADR-0001 — Estrutura modular e Clean Architecture aplicada

- **Status:** accepted
- **Data:** 2026-04-14
- **Autor:** Alexandre (solo dev)

## Contexto

O codebase atual (AAZ Studio, 19k linhas) está organizado pragmaticamente
mas sem boundaries formais. Rotas Next.js contêm regra de negócio, helpers
de domínio moram em `src/lib/` misturados com adapters de infra, e o
frontend é um monólito de 8k linhas.

Para a refatoração universal (extração do produto do universo "AAZ com
Jesus"), precisamos de uma estrutura que:

1. Permita crescer de monolito a sistema modular sem big bang.
2. Proteja o domínio de detalhes de infra (Redis, Anthropic, Segmind).
3. Seja óbvia o suficiente para um dev solo manter sem ferramentas pesadas.
4. Facilite testes unitários rápidos do domínio.

## Decisão

Adotar **Clean Architecture pragmática** em módulos. A nova estrutura é
introduzida **incrementalmente** — módulos existentes só migram quando
tocados por PR do refactor.

### Layout alvo

```
src/
├── shared/                    # Value objects, errors, tipos primitivos
├── modules/
│   ├── identity/
│   │   ├── domain/            # Entidades + regras puras (zero I/O)
│   │   ├── usecases/          # Orquestração de regra (1 arquivo = 1 ação)
│   │   ├── ports/             # Interfaces (contratos com o mundo)
│   │   └── infra/             # Implementações concretas (Redis, etc.)
│   ├── workspaces/
│   ├── library/
│   ├── projects/
│   ├── orchestration/
│   ├── prompts/
│   └── billing/
├── providers/                 # Adapters para SaaS externos (ex.: segmind)
└── app/                       # Next.js (routes + components)
```

### Regras duras

1. `domain/` **nunca** importa de `infra/`, `providers/`, `app/` ou libs de I/O.
2. `usecases/` depende de **ports**, não de implementações.
3. `app/api/*/route.ts` é **thin** — parseia request, chama usecase, serializa.
4. `src/lib/` continua existindo para helpers legados, mas é *read-only*
   para código novo. Nada novo é adicionado lá.

### Migração incremental

Módulos migram sob demanda. Ordem prevista nos PRs do M1:

| PR | Módulos introduzidos |
|----|----------------------|
| #2 | `prompts` |
| #4 | `library` (parcial: characters) |
| #5 | `library` (styleProfiles) |
| #7 | `workspaces`, `identity` (parcial) |

`src/lib/` é esvaziado gradualmente nos PRs do M2+.

## Consequências

**Ganhamos:**
- Testes unitários do domínio sem mocks complexos (domain é puro).
- Troca de provider (Segmind → outro) fica local no adapter.
- Boundary claro entre "regra" e "infraestrutura" reduz dívida técnica.

**Perdemos:**
- Mais arquivos por feature (4 pastas vs 1 arquivo em `lib/`).
- Onboarding requer entender a separação (mas só há 1 dev).

**Riscos:**
- Tentação de "over-engineer" módulos que não precisam. Mitigação: só
  divide em 4 camadas quando a regra de negócio justifica.

## Alternativas consideradas

1. **Feature folders sem camadas.** Mais simples, mas não protege domínio
   de infra. Descartado porque o refactor precisa trocar providers sem
   reescrever regras.

2. **Hexagonal pura com DI container.** Over-engineering para um dev solo.
   Descartado. Composition root fica manual.

3. **Manter `src/lib/` como está.** Significa carregar débito técnico
   para o M2/M3. Descartado — o custo de refactor cresce com o tempo.

## Referências

- [Blueprint do produto, seção 9](../../CLAUDE.md)
- Clean Architecture (Uncle Bob, 2017) — princípios gerais.
