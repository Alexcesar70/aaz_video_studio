# Milestone 1 — Rollout Checklist

> Plano para promover as **4 feature flags** entregues no M1 ao longo
> de produção. Cada flag tem um caminho de canário → global → consolidação.
>
> Princípio: **uma flag por vez**, com 3–7 dias entre canário e global.
> Sem staging, então a ordem é sequencial e cuidadosa.

---

## Flags entregues no M1

| Flag | PR | Backend | Frontend | Risco | Observabilidade |
|---|---|---|---|---|---|
| `USE_DB_PROMPTS` | #3 | sim | nenhum | baixo | activity event `promptSource` |
| `USE_DB_ONLY_CHARACTERS` | #4 | sim | nenhum | baixo-médio | response inclui `source: 'db' \| 'merge'` |
| `USE_STYLE_PROFILES` | #6 | sim | nenhum | médio | activity event `styleSource` |
| `NEW_SIGNUP_WIZARD` | #7 | sim | sim (login page) | **alto** (caminho crítico) | response inclui `needsWorkspaceSetup` |

---

## Pré-requisitos antes de qualquer flag

1. ✅ **Tag `v0.0.1`** existe — rollback nuclear via `git checkout v0.0.1`.
2. ✅ **Backup do Redis** — exporte `aaz:*` antes do primeiro seed em produção.
3. ✅ **Smoke E2E local passando** — `npm run test:e2e` antes de cada deploy.
4. ✅ **Checklist de paridade funcional** validado manualmente (ver
   `CLAUDE.md`).

---

## Ordem recomendada de rollout

### Passo 1 — Seeds (sem flags ligadas, idempotentes)

```bash
# Como super_admin (Alexandre), depois do deploy do `universal`:

# 1.1 — PromptTemplates (PR #3)
curl -X POST https://aaz-video-studio.vercel.app/api/admin/prompts/seed \
  -H "Cookie: aaz_session=<sua-session>"
# Esperado: { summary: { created: 4, ... } }

# 1.2 — Lead Characters (PR #4)
curl -X POST https://aaz-video-studio.vercel.app/api/admin/characters/seed \
  -H "Cookie: aaz_session=<sua-session>" \
  -H "Content-Type: application/json" \
  -d '{"strategy":"skip"}'
# Esperado: { summary: { created: 7, ... } }

# 1.3 — Style Profiles (PR #6)
curl -X POST https://aaz-video-studio.vercel.app/api/admin/style-profiles/seed \
  -H "Cookie: aaz_session=<sua-session>"
# Esperado: { summary: { created: 6, ... } }
```

**Validação:**
```bash
curl https://aaz-video-studio.vercel.app/api/admin/prompts \
  -H "Cookie: aaz_session=<sua-session>" | jq '.templates | length'
# Esperado: 4

curl "https://aaz-video-studio.vercel.app/api/admin/style-profiles?isOfficial=true" \
  -H "Cookie: aaz_session=<sua-session>" | jq '.profiles | length'
# Esperado: 6

curl "https://aaz-video-studio.vercel.app/api/assets?type=character" \
  -H "Cookie: aaz_session=<sua-session>" | jq '.assets | length'
# Esperado: >= 7
```

---

### Passo 2 — Flag `USE_DB_PROMPTS` (PR #3) — **menor risco**

**Por quê primeiro:** caminho de leitura de prompt do Claude. Se quebrar,
fallback automático pro hardcoded. Saída visual idêntica.

```bash
# Canário (apenas Alexandre)
FF_USE_DB_PROMPTS_USERS=alexandre

# Validar:
# - Gerar 1 cena Seedance via Scene Director.
# - No admin dashboard, evento deve ter promptSource='db', promptVersion=1.
# - Output da cena deve ser idêntico ao pré-flag.

# Após 24h sem incidente:
FF_USE_DB_PROMPTS=on
# (remova FF_USE_DB_PROMPTS_USERS — fica redundante)

# Monitoramento por 3-7 dias.
```

**Rollback instantâneo:** `FF_USE_DB_PROMPTS=off`

---

### Passo 3 — Flag `USE_STYLE_PROFILES` (PR #6) — **risco médio**

**Por quê depois:** mexe na composição do prompt de imagem. Guides
genéricos podem ter sutil diferença de output.

```bash
FF_USE_STYLE_PROFILES_USERS=alexandre

# Validar no Atelier:
# - Gerar 1 character + 1 scenario + 1 item com mood 'warm'.
# - Comparar visual com pré-flag.
# - Activity event deve ter styleSource='db', styleProfileSlug='clay-massinha'.
# - Output deve manter clay aesthetic mesmo com guides genéricos.

# Após 3-7 dias:
FF_USE_STYLE_PROFILES=on
```

---

### Passo 4 — Flag `USE_DB_ONLY_CHARACTERS` (PR #4) — **risco médio**

**Por quê:** workspace AAZ continua vendo os 7 leads (vieram do seed).
Workspace de outros tenants não vê AAZ — isso é a CORREÇÃO de tenant
isolation. Validar que ninguém depende do bug antigo.

```bash
FF_USE_DB_ONLY_CHARACTERS_USERS=alexandre

# Validar:
# - GET /api/assets?type=character como Alexandre → 7 leads aparecem.
# - Response inclui source='db'.
# - Studio carrega character picker normalmente.
# - Gerar uma cena com @abraao funciona.

# Após 3-7 dias:
FF_USE_DB_ONLY_CHARACTERS=on
```

---

### Passo 5 — Flag `NEW_SIGNUP_WIZARD` (PR #7) — **risco ALTO** ⚠️

**Por quê último:** caminho crítico do login. Validar muito.

```bash
# 5.1 — Criar um usuário órfão para teste
curl -X POST https://aaz-video-studio.vercel.app/api/admin/users \
  -H "Cookie: aaz_session=<sua-session>" \
  -H "Content-Type: application/json" \
  -d '{
    "email":"wizard-test@example.com",
    "name":"Wizard Test",
    "password":"<senha-forte>",
    "role":"creator"
  }'
# IMPORTANTE: NÃO informar organizationId — user nasce órfão.

# 5.2 — Canário só para esse user
FF_NEW_SIGNUP_WIZARD_USERS=wizard_test

# 5.3 — Login com wizard-test@example.com → deve aparecer step 2.
#       Criar workspace "Wizard Studio" → redirect /studio.
#       Validar:
#       - GET /api/auth/me: organizationId = "wizard-studio" ou similar.
#       - GET /api/me/wallet: wallet criada com saldo=0.
#       - Atelier mostra biblioteca vazia (sem AAZ leads — ✅ isolation correto).
#       - Voltar como Alexandre: ainda em aaz-com-jesus, com 7 leads, sem mudança.

# 5.4 — Após 3-7 dias sem incidente:
FF_NEW_SIGNUP_WIZARD=on
# Novos users criados sem orgId verão o wizard.
# Users existentes em aaz-com-jesus continuam normais.
```

**Rollback CRÍTICO se quebrar login:**
```bash
FF_NEW_SIGNUP_WIZARD=off  # volta ao auto-assign aaz-com-jesus
```

Se algum user ficou em estado órfão (sem orgId, mas wizard quebrou),
admin pode atribuir manualmente:
```bash
curl -X POST https://aaz-video-studio.vercel.app/api/admin/users/<userId> \
  -H "Cookie: aaz_session=<sua-session>" \
  -d '{"organizationId":"aaz-com-jesus"}'
```

---

## Pós-rollout — Consolidação (M2 PR de limpeza)

Após **todas as 4 flags** estarem `=on` em produção por 30+ dias sem
incidente, abrir PR de consolidação que:

1. Remove o caminho `else` legado em todas as rotas (`scene-director`,
   `image-director`, `lyrics-director`, `assets`, `auth/login`).
2. Remove `getImageDirectorSystemPrompt` (legacy fallback).
3. Remove `getSceneDirectorSystem` wrapper (legacy fallback).
4. Remove `LEAD_CHARACTERS` re-export de `src/lib/assets.ts`.
5. Remove auto-assign `aaz-com-jesus` em `/api/auth/login`.
6. Remove as 4 entradas do `FeatureFlag` union type.
7. Remove env vars da Vercel.
8. Atualiza este checklist marcando completo.

**NÃO remover** os seeds — eles continuam materializando o universo
AAZ como tenant configurado.

---

## Sumário visual

```
[deploy universal]
        │
        ▼
[seeds (3 endpoints, idempotentes)]
        │
        ▼
[USE_DB_PROMPTS canário → global]   (3-7 dias)
        │
        ▼
[USE_STYLE_PROFILES canário → global]   (3-7 dias)
        │
        ▼
[USE_DB_ONLY_CHARACTERS canário → global]   (3-7 dias)
        │
        ▼
[NEW_SIGNUP_WIZARD canário → global] ⚠️ caminho crítico (3-7 dias)
        │
        ▼
[30 dias sem incidente]
        │
        ▼
[PR de consolidação — remove todos os fallbacks legados]
```

Tempo total realista: **5-8 semanas** do deploy ao removal. Sem pressa
— o produto continua funcionando 100% durante todo o processo.
