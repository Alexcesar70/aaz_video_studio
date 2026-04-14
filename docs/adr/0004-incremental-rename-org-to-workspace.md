# ADR-0004 — Rename semântico Organization → Workspace é incremental, não big-bang

- **Status:** accepted
- **Data:** 2026-04-14
- **Autor:** Alexandre (solo dev)

## Contexto

Durante o M1, o conceito central de tenancy foi formalizado como
**Workspace** (ver ADR-0003). No código, porém, ele está persistido
como `Organization` com chaves Redis `aaz:org:*` e usado em centenas
de locais:

- `User.organizationId` em tipos
- `x-org-id` no middleware
- `organizationId` em activity events
- Campos em TODAS as rotas CRUD (scenes, episodes, projects, assets,
  cantigas, library)
- `getOrgById`, `listOrganizations`, `createOrganization` etc.

Um find-and-replace global produziria um PR com 30+ arquivos tocados,
alto risco de regressão no caminho crítico, e diff quase impossível
de revisar com segurança sem ambiente de staging.

## Decisão

Rename acontece em **camadas, progressivamente**:

1. **PR #8 (este):** cria nomenclatura nova **em paralelo**:
   - Tipo alias: `Workspace` = `Organization`.
   - Função re-exports: `createWorkspace`, `getWorkspaceById`,
     `listWorkspaces`, etc. no módulo `@/modules/workspaces`.
   - `AuthUser.workspaceId` (novo campo canônico) + `organizationId`
     (mantido, marcado `@deprecated`). Ambos populados do mesmo header.
   - Nenhuma chave Redis muda (`aaz:org:*` permanece).
   - Nenhum consumer legado é forçado a migrar.

2. **Durante M1–M2:** código novo usa `Workspace`; código legado fica
   até ser tocado por outro motivo (bug fix, nova feature). Toque
   oportuno migra.

3. **PR #9 (consolidação do M1):** varre remanescentes nos módulos
   tocados pelo M1. Rotas/componentes não tocados seguem legados.

4. **M2 / M3:** migração do Redis para Postgres coincide com rename
   definitivo. Os schemas novos usam `workspace_id`; mapping
   translator conviverá por 1 fase.

## Consequências

**Ganhamos:**

- Zero risco de regressão neste PR (aliases puros, mesmo comportamento).
- Código novo pode usar semântica correta imediatamente.
- Revisão humana trivial — diff < 200 linhas.
- Rollback é `git revert` limpo.

**Perdemos:**

- Duplicação cosmética: por um tempo, o produto tem `Workspace` em
  algumas camadas e `Organization` em outras. Confusa para quem está
  entrando no code-base.
- Disciplina necessária: novos consumers devem importar de
  `@/modules/workspaces`, não de `@/lib/organizations`.

**Mitigação:**

- `@/lib/organizations` ganha JSDoc no topo indicando "use
  @/modules/workspaces em código novo".
- Linter custom pode ser adicionado no M2 para avisar imports legados
  (opcional).

## Regra prática (para Alexandre e para Claude Code)

Código novo:
```typescript
// ✅ CORRETO
import type { Workspace } from '@/modules/workspaces'
import { createWorkspace, getWorkspaceById } from '@/modules/workspaces'

const ws = await getWorkspaceById(id)
```

Código legado existente:
```typescript
// ✅ CONTINUA FUNCIONANDO (sem forçar migração)
import type { Organization } from '@/lib/organizations'
import { getOrgById } from '@/lib/organizations'
```

Ao TOCAR código legado por outro motivo, migrar de bônus:
```typescript
// 🔄 OPORTUNIDADE — migrar quando editar por outro motivo
-import type { Organization } from '@/lib/organizations'
+import type { Workspace } from '@/modules/workspaces'
```

## Alternativas descartadas

1. **Rename big-bang.** Inviável sem staging. Diff gigante, risco alto.

2. **Manter só `Organization`.** Não resolve o débito semântico — o
   produto se chama Workspace no blueprint e precisa se chamar assim no
   código para onboarding novo.

3. **Persistência renomeada agora (Redis `aaz:ws:*`).** Exigiria
   migração de dados viva em produção sem staging. Descartado até
   poder ser feito contra Postgres (M2).
