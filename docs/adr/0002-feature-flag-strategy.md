# ADR-0002 — Estratégia de feature flags sem staging

- **Status:** accepted
- **Data:** 2026-04-14
- **Autor:** Alexandre (solo dev)

## Contexto

O refactor universal (Milestone 1) envolve substituições críticas:
prompts de sistema, migração de characters para DB, rename de
Organization→Workspace, wizard de signup, entre outros. Qualquer um
desses pode regredir fluxos hoje em produção.

**Restrições reais:**

- **Não há ambiente de staging.** Dev local + produção na Vercel.
- **Dev solo.** Não há revisor humano para PR.
- **Usuários reais em produção.** Incluindo criadores pagantes.
- **Sem CI rodando testes hoje.** Primeiro PR introduz Vitest + Playwright.

Precisamos de uma estratégia que permita **merge na main sem ligar a
mudança para todo mundo**, e que permita **rollback em 1 segundo** sem
reverter código.

## Decisão

Adotar **feature flags via env vars da Vercel**, com 3 modos de rollout:

### Modelo de resolução (ordem de precedência)

1. `FF_{FLAG}=off` → **kill-switch global**. Desliga para todos.
2. `FF_{FLAG}_USERS=<ids>` → **rollout targetado por user**. Liga só
   para IDs listados.
3. `FF_{FLAG}_WORKSPACES=<ids>` → **rollout targetado por workspace**.
4. `FF_{FLAG}=on` → **rollout global**. Liga para todos.
5. Default: **off**.

### Rollout recomendado por feature do refactor

```
[merge com flag OFF]
    ↓
[dev testa em localhost com FF_...=on no .env.local]
    ↓
[Vercel: FF_..._USERS=<meu-user-id>]     ← só o dono vê, produção
    ↓
[Vercel: FF_..._USERS=<me>,<1-2 creators>]  ← canário de confiança
    ↓
[Vercel: FF_...=on]                       ← rollout global
    ↓
[próximo PR remove o legado + a flag]
```

### Convenção

- Flags vivem em `src/lib/featureFlags.ts` com union type `FeatureFlag`.
- Toda flag tem **validade esperada** declarada no PR que a cria
  (ex.: "remover quando PR #9 mergear").
- Flag órfã vira débito — review mensal durante M1/M2.

### Paridade funcional sem staging

Como não há staging, paridade é validada em 3 camadas:

1. **Vitest** unit tests do domínio (sem I/O, rápido).
2. **Playwright** smoke tests contra `localhost:3000` com env vars de
   teste (`E2E_ADMIN_EMAIL`, etc.).
3. **Checklist manual** pré-merge (documentado em cada PR):
   - Login admin funciona
   - Gerar vídeo Seedance produz output consistente
   - Wallet deduz valor correto
   - Admin dashboard carrega

Geração real (paga) é validada **manualmente** — smoke tests não
disparam Segmind/Anthropic.

## Consequências

**Ganhamos:**
- Merges frequentes sem risco de quebrar produção.
- Rollback instantâneo via painel Vercel (vs. revert + redeploy).
- Canário por usuário permite testar em real user com 1 clique.

**Perdemos:**
- Complexidade adicional: todo caminho novo precisa conviver com o
  antigo até a flag ser removida.
- Tentação de deixar flags para sempre. Mitigação: limite explícito no PR.

**Riscos:**
- Código morto após remoção de flag esquecida. Mitigação: review mensal
  + grep por `isFeatureEnabled` nos PRs de consolidação.
- Env vars crescendo na Vercel. Mitigação: prefixo `FF_` facilita limpeza.

## Alternativas consideradas

1. **Serviços tipo LaunchDarkly / Flagsmith.** Overkill para dev solo,
   custo recorrente, complexidade de infra. Descartado.

2. **Flag em Redis com UI própria.** Construir UI = escopo do M1+.
   Descartado. Env var é mais rápido e auditável no log da Vercel.

3. **Sem feature flags, só revert em caso de bug.** Inviável: sem
   staging, cada merge vira risco de incidente em produção real.

## Referências

- [Blueprint do produto, seção 15 (Riscos)](../../CLAUDE.md)
- [src/lib/featureFlags.ts](../../src/lib/featureFlags.ts) — implementação.
