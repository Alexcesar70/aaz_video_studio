# ADR-0003 — Workspace como unidade de tenancy; Individual é Workspace com maxUsers=1

- **Status:** accepted
- **Data:** 2026-04-14
- **Autor:** Alexandre (solo dev)

## Contexto

O produto está evoluindo de "studio interno do AAZ com Jesus" para
**Creative Studio SaaS universal**. Dois perfis de cliente são
suportados: **criador individual** e **equipe**.

A questão: esses dois perfis devem ser entidades distintas no domínio,
ou um caso particular da mesma entidade?

Opções avaliadas:

1. **Entidades separadas** — `IndividualAccount` + `Team` como tipos
   distintos. Dois fluxos de signup, duas telas de configuração, duas
   lógicas de billing.

2. **Workspace único com `type` discriminante** — uma única entidade
   `Workspace` que representa ambos os casos. Campo `type: 'individual'
   | 'team'` + regra invariante (`individual` → `maxUsers=1`).

O código legado já tinha `Organization.type: 'individual' | 'team'`
(herdado do Phase 1 multi-tenant). PR #7 formaliza a decisão e
estabelece o fluxo de signup.

## Decisão

Adotar o modelo **Workspace único com `type` discriminante**:

- **Workspace** é a unidade de tenancy. Todos os recursos (characters,
  scenes, projects, assets, wallet) pertencem a UM workspace.
- `Workspace.type = 'individual'` **obriga** `maxUsers = 1`.
- `Workspace.type = 'team'` **obriga** `maxUsers >= 2`.
- Um User pertence a N workspaces via Membership (M2 materializa; M1
  ainda usa 1:1 via `User.organizationId`).
- Transição individual → team é **upgrade de plano + mudança de type**,
  não migração de dados (mesma entidade).

## Consequências

**Ganhamos:**

- Código de CRUD, queries e permissões funciona para ambos os casos
  com o mesmo shape. Diferença entre individual e team é política
  (checks de permissão e billing), não modelagem.
- Fluxo de upgrade Individual → Team é trivial: atualiza `type` +
  `maxUsers`, troca de plano. Sem migração de dados.
- Mesma UI, mesma API. Frontend condiciona features por `type` quando
  necessário (ex.: convidar membros só aparece em team).
- Consistência com padrão da indústria (Notion, Figma, Linear — todos
  modelam assim).

**Perdemos:**

- Validação espalhada — `type=individual + maxUsers > 1` é bug que
  precisa ser bloqueado em múltiplos pontos. Mitigado centralizando em
  `validateCreateWorkspaceInput`.
- Eventual confusão para o creator ("por que meu workspace individual
  tem campo maxUsers?"). Mitigado escondendo o campo na UI quando
  `type=individual`.

**Riscos:**

- Futuramente, billing por usuário (team) vs billing flat (individual)
  pode exigir lógica divergente. Mitigação: colocar essa lógica no
  módulo `billing`, não em `workspaces`. O domínio de Workspace
  permanece homogêneo.

## Relacionado

- `createWorkspaceForUser` use case (PR #7) é a entrada canônica para
  novos workspaces. Valida invariantes.
- `POST /api/workspaces` exposta ao wizard de signup (flag
  `NEW_SIGNUP_WIZARD`).
- Rename semântico `Organization → Workspace` no código acontece no
  PR #8 (code-only, Redis keys mantidas para retrocompat).

## Alternativas descartadas

1. **Duas entidades separadas.** Duplicaria CRUD, permissões, billing,
   UI. Overhead sem benefício real — ambos os perfis compartilham
   90% do modelo.

2. **Só Team; Individual = team com 1 membro implícito.** Força a
   expor UI de "membros" em conta individual — UX ruim.

3. **Only Individual; Team = vários Individuals linkados.** Confunde
   ownership de assets compartilhados. Descartado.
