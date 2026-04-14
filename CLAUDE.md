# AAZ STUDIO — BRIEFING PARA CLAUDE CODE

**REGRA: sempre atualize este arquivo ao final de cada implementação.**

Você está trabalhando no **AAZ Studio**, um app Next.js 14 interno de produção
de cenas para o projeto de animação cristã infantil **AAZ com Jesus**.
Desenvolvedor: **Alexandre** (solo).

---

## 🔧 REFACTOR UNIVERSAL EM ANDAMENTO (branch `universal`)

**Contexto.** O produto está sendo generalizado de "studio AAZ com Jesus" para
**Creative Studio SaaS universal** — agnóstico de universo narrativo. Base
criada como tag `v0.0.1` (snapshot pré-refactor). Toda evolução nova acontece
em sub-branches `refactor/m1-*` que abrem PR contra `universal`.

### Regras do refactor (vale para todo PR do M1+)

1. **Paridade funcional obrigatória.** AAZ Studio continua funcionando idêntico
   enquanto o refactor acontece. Nenhum PR pode regredir fluxo existente.
2. **Feature flags em tudo que é risco.** Default OFF. Liga primeiro para o
   próprio dono via `FF_{FLAG}_USERS=<userId>`, depois canário, depois global.
   Sistema em `src/lib/featureFlags.ts`. Ver [ADR-0002](./docs/adr/0002-feature-flag-strategy.md).
3. **PRs pequenos (< 400 linhas).** Se estoura, quebra em dois.
4. **Sem migração big bang.** Redis continua como está no M1. Postgres só no M2.
5. **Estrutura modular em Clean Arch.** Código novo vai para `src/modules/<contexto>/`
   seguindo `domain/ usecases/ ports/ infra/`. `src/lib/` é read-only para
   código novo. Ver [ADR-0001](./docs/adr/0001-module-structure.md).
6. **Toda decisão estruturante vira ADR** em `docs/adr/`.
7. **Testes antes do refactor.** Vitest (unit) + Playwright (smoke) rodam
   antes de qualquer mudança em rota crítica.

### Comandos de teste

```bash
npm run test           # Vitest — testes unitários do domínio
npm run test:watch     # Vitest em watch mode
npm run test:e2e       # Playwright — smoke tests (requer dev server + env vars)
npm run test:e2e:ui    # Playwright em modo interativo
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

### Roadmap dos PRs do M1 — Agnostic Core

- [x] **PR #1** — Guardrails (Vitest + Playwright + feature flags + ADRs)
- [x] **PR #2** — Módulo `prompts` + `PromptTemplate` entity (seed via `POST /api/admin/prompts/seed`)
- [x] **PR #3** — Directors leem do repositório (flag `USE_DB_PROMPTS`, paridade validada)
- [x] **PR #4** — Characters migrados para registros de DB (flag `USE_DB_ONLY_CHARACTERS`, seed em `POST /api/admin/characters/seed`)
- [x] **PR #5** — `StyleProfile` como entidade de primeira classe (6 presets globais)
- [x] **PR #6** — Image Director usa StyleProfile (flag `USE_STYLE_PROFILES`) + `GET /api/style-profiles` público + Moods decouple (narrativas universe-neutral, injections visuais preservadas)
- [ ] **PR #7** — Signup wizard + Workspace criation
- [ ] **PR #8** — Rename semântico Organization → Workspace (code-only)
- [ ] **PR #9** — Consolidação + criação do `PROJECT.md` (universal)

### Checklist de paridade funcional (roda antes de cada merge)

- [ ] Login admin (Alexandre) funciona
- [ ] Login creator existente funciona
- [ ] Gerar vídeo Seedance com Abraão → output clay, consistente
- [ ] Gerar imagem Nano Banana → output AAZ style
- [ ] Scene Director retorna PT/ES/EN válidos
- [ ] Criar scene, salvar, listar no histórico
- [ ] Wallet deduz valor correto
- [ ] Admin dashboard carrega KPIs

---

## STATUS ATUAL DAS FASES

### Fase 1 — Scaffolding + Auth (COMPLETA)

- `src/middleware.ts` — auth JWT em todas as rotas (cookie `aaz_session`)
- `src/app/login/page.tsx` — tela de login com visual do projeto
- `src/app/studio/page.tsx` — rota protegida principal
- `src/components/AAZStudio.tsx` — UI completa ('use client')
- `src/app/api/auth/login/route.ts` — POST → verifica credenciais → cookie JWT 7d
- `src/app/api/auth/logout/route.ts` — POST → apaga cookie
- `src/app/api/auth/me/route.ts` — GET → retorna user logado
- `vercel.json` — timeouts 300s para rotas Segmind

### Fase 2 — API Routes Segmind (COMPLETA)

- `/api/generate/route.ts` — proxy multi-engine Segmind para vídeo
  - Suporta 6 engines: Seedance 2.0, Seedance 2.0 Fast, Wan 2.7 R2V, Kling 2.5 Turbo, Veo 3.1 Lite, Veo 3.1
  - Omni Reference (até 9 refs), first/last frames, áudio
  - Upload permanente do vídeo ao Vercel Blob
  - Budget check antes de chamar o Segmind (bloqueia se excedeu)
  - **Custo real**: captura saldo Segmind antes/depois via `getSegmindCredits()` (`src/lib/segmind.ts`)
  - Fallback automático para estimativa se o endpoint de créditos falhar
  - Resposta inclui: `costUsd`, `costSource` ('real'|'estimated'), `estimatedCostUsd`, `realCostUsd`
- `/api/generate-sheet/route.ts` — proxy Consistent Character AI Neolemon V3
- `/api/generate-image/route.ts` — proxy multi-engine para imagens (Atelier)
- `src/lib/videoEngines.ts` — registro de 6 engines de vídeo com preços
- `src/lib/imageEngines.ts` — registro de engines de imagem com preços
- `src/lib/segmind.ts` — helper `getSegmindCredits(apiKey)` para saldo real

### Fase 3 — Vercel KV / Biblioteca (COMPLETA)

- `/api/library/route.ts` — GET/POST character sheets
- `/api/library/[id]/route.ts` — GET/DELETE individual
- `/api/assets/route.ts` — CRUD de assets (personagens, cenários, itens)
- `/api/scenes/route.ts` — CRUD de cenas
- `/api/projects/route.ts` — CRUD de projetos
- `/api/episodes/route.ts` — CRUD de episódios + delivery workflow
- `/api/scenarios/route.ts` — CRUD de cenários
- `src/lib/redis.ts` — cliente Redis/KV compartilhado
- `src/lib/assets.ts` — operações de assets no KV

### Fase 4 — Scene Director + Image Director (COMPLETA)

- `/api/scene-director/route.ts` — Claude API trilíngue (PT-BR + ES + EN)
  - System prompt com regras do universo AAZ
  - Modelo: `claude-sonnet-4-20250514`
- `/api/image-director/route.ts` — Claude API para refinar prompts de imagem
- `src/lib/sceneDirectorSystem.ts` — system prompt do Scene Director
- `src/lib/imageDirectorSystem.ts` — system prompt do Image Director
- `src/lib/moods.ts` — 6 presets de mood/tom visual

### Fase 5 — Deploy Vercel (COMPLETA)

- Deploy automático via push no branch `main`
- Env vars configuradas no painel Vercel
- Vercel KV conectado
- Vercel Blob para vídeos e imagens

### Funcionalidades adicionais implementadas

- **Auth multi-user**: login por email/senha, roles admin/creator
- **Activity tracking**: stream de eventos no Redis (`src/lib/activity.ts`)
  - Eventos: login, scene_generated, image_generated, asset_saved, etc.
  - Agregados diários por user (`aaz:daily:{YYYY-MM-DD}:{userId}`)
- **Admin Panel** (aba Admin no AAZStudio.tsx):
  - Dashboard: KPIs (gasto mês, criadores ativos, cenas/semana, assets/semana)
  - Top criadores por gasto + motores mais usados (nomes clicáveis)
  - Feed de atividade recente com badge REAL/est. por evento (nomes clicáveis)
  - Gestão de usuários (criar, editar budget, roles)
  - Fila de revisão de episódios (delivery workflow)
  - Aba Gastos detalhados por usuário/mês com cards histórico mensal (nomes clicáveis)
  - Seletor de mês no header (últimos 6 meses) — re-fetch automático de eventos
  - **UserDetailModal**: extrato completo do usuário no mês (KPIs, lista cronológica tipo bank statement, custo por motor)
- **Budget caps**: limite mensal por creator, hard block no backend, barra no header
- **Episode delivery**: upload MP4 final + revisão admin (aprovar/pedir ajustes)
- **Atelier**: criação de assets visuais (personagens, cenários, itens)
- **Chain contextual**: continuidade semântica entre cenas
- **Custo real de vídeo**: saldo Segmind antes/depois por geração
  - Campo `costSource` nos eventos de atividade ('real' ou 'estimated')
  - Painel admin exibe badge REAL (verde) ou est. (cinza) por evento
  - Sistema de budget/relatórios usa custo real quando disponível

### Multi-tenant Phase 1 — Org/Plan/Wallet models (COMPLETA)

- `src/lib/organizations.ts` — Organization, Plan, Wallet models no Redis
- `src/lib/users.ts` — User.organizationId opcional
- `src/middleware.ts` — injeta `x-org-id` header a partir do JWT
- `src/lib/auth.ts` — AuthUser.organizationId lido de `x-org-id`
- Lead admin auto-promovido a `super_admin` no login
- Bootstrap cria org padrão "AAZ com Jesus" (id: `aaz-com-jesus`)

### Multi-tenant Phase 2 — Data isolation by organization (COMPLETA)

- **Org-scoped queries**: todas as rotas CRUD filtram por `organizationId` no GET
  - Usuários em org veem dados da org + dados legados (sem orgId)
  - Super admin sem org vê tudo
  - Dados legados (pré-Phase 2) continuam acessíveis (sem orgId = visível a todos da org)
- **Org stamp on creation**: todas as rotas POST gravam `organizationId` no registro
  - `/api/projects`, `/api/episodes`, `/api/scenes`, `/api/assets`
  - `/api/scenarios`, `/api/library`
- **Activity events**: todos os `emitEvent()` incluem `organizationId` do usuário
  - 17 call sites atualizados (login, generate, director, assets, scenes, episodes, budget, users)
  - `ActivityEvent.organizationId` field já existia na interface
- **Activity API filtering**: `/api/activity` (mode=events) filtra por orgId do admin
- **Asset model**: `Asset` interface em `src/lib/assets.ts` ganhou campo `organizationId`
- **Nenhuma chave Redis renomeada** — retrocompat total

### Phase 4 — Granular Permissions + Product Access (COMPLETA)

- `src/lib/permissions.ts` — constantes, tipos e helpers de permissão/produto
  - 7 permissões: `generate_video`, `generate_image`, `use_scene_director`, `use_image_director`, `manage_episodes`, `manage_assets`, `view_analytics`
  - 3 produtos: `aaz_studio`, `courses`, `community`
  - `hasPermission()` — checa permissão com fallback para defaults do role
  - `hasProductAccess()` — checa acesso a produto (org-level + user-level)
  - `DEFAULT_PERMISSIONS` — mapa role -> permissões default
  - `PERMISSION_LABELS` / `PRODUCT_LABELS` — labels PT-BR para UI
- **JWT + middleware**: permissions/products incluídos no JWT e propagados via headers
  - `src/middleware.ts` — injeta `x-user-permissions` e `x-user-products`
  - `src/lib/auth.ts` — `AuthUser.permissions` e `AuthUser.products` lidos dos headers
  - `/api/auth/login` — inclui permissions/products no JWT payload e na resposta
  - `/api/auth/me` — retorna effective permissions (explicit ou default do role)
- **Permission checks em 8 API routes**:
  - `/api/generate` — `generate_video`
  - `/api/generate-image` — `generate_image`
  - `/api/generate-sheet` — `generate_image`
  - `/api/scene-director` — `use_scene_director`
  - `/api/image-director` — `use_image_director`
  - `/api/episodes` (POST) — `manage_episodes`
  - `/api/episodes/[id]` (PATCH/DELETE) — `manage_episodes`
  - `/api/assets` (POST) — `manage_assets`
- **UI (AAZStudio.tsx)**:
  - Botões de gerar desabilitados + tooltip quando sem permissão
  - InviteUserModal com checkboxes de permissões e produtos
  - Tipo `CurrentUser` unificado com `permissions?` e `products?`
- **Admin user management**: `/api/users` POST e `/api/users/[id]` PATCH aceitam permissions/products
- **Retrocompat total**: users sem permissions explícitas herdam defaults do role

### Phase 6 — BRL Conversion Toggle + Exportable Statements (COMPLETA)

- `/api/currency/route.ts` — GET retorna cotação USD→BRL atual
  - Usa `getUsdToBrl()` de `src/lib/currency.ts` (cache Redis 1h, fallback 5.50)
  - Retorna `{ rate, updatedAt, source }` — endpoint público (sem auth)
- `/api/me/wallet/transactions/route.ts` — GET transações da wallet do usuário
  - Query params: `from`, `to` (YYYY-MM-DD), `limit` (default 100, max 1000)
  - Auth required, retorna transações da wallet da org do usuário
- `/api/me/wallet/export/route.ts` — GET exporta extrato como CSV
  - Query params: `from`, `to` (YYYY-MM-DD)
  - CSV com BOM UTF-8 para compatibilidade Excel
  - Colunas: Data, Tipo, Descrição, Valor (USD), Saldo (USD)
  - Content-Disposition attachment para download
- **BRL toggle no header** (AAZStudio.tsx):
  - Botão `R$` ao lado do WalletPill — ativa/desativa conversão BRL
  - Fetch da cotação no primeiro toggle (cacheado em state)
  - WalletPill mostra saldo em BRL quando ativo
  - KPI "Gasto este mês" mostra BRL quando ativo
  - Top criadores mostram custo em BRL quando ativo
  - Disclaimer "Cotação aproximada" no admin dashboard
- **WalletExtratoModal** (AAZStudio.tsx):
  - Acessível ao clicar no WalletPill
  - Lista transações em ordem cronológica reversa (mais recente primeiro)
  - Filtro de data (de/até)
  - Resumo: entradas, saídas, total de transações (com BRL quando ativo)
  - Cada linha: data, tipo (PT-BR), descrição, valor (verde/vermelho), saldo
  - Botão "Baixar CSV" para exportar extrato
  - Fecha com ESC ou click fora (mesmo padrão dos outros modais)

### Phase 3 — Super Admin Console `/admin` (COMPLETA)

- `src/components/SuperAdmin.tsx` — UI completa com sidebar + 8 views
- `src/app/admin/layout.tsx` + `page.tsx` — rota `/admin` (super_admin only)
- **Dashboard**: 4 KPIs financeiros (receita de uso, custos, lucro bruto, saldo Segmind)
  - Alertas automáticos (saldo baixo, prejuízo, orgs inativas)
  - Tabela L/P Acumulados (venda vs custo vs lucro por transação)
  - Top clientes + Operacional
  - KPIs clicáveis → páginas dedicadas
- **3 Páginas financeiras dedicadas**:
  - Receita Bruta: ranking clientes, ticket médio, histórico recargas
  - Custos Totais: breakdown Segmind/Claude, custo por engine, lista cronológica
  - Lucro/Prejuízo: margem por engine, L/P por transação, engine +/- lucrativa
- **Organizações**: tabela + dashboard financeiro por org (saldo, membros, engines, transações)
  - Criar nova org com formulário completo
  - Adicionar créditos, suspender/reativar
  - Associação automática de users órfãos
- **Planos**: criar/editar/desativar planos (nome, preço, créditos, max users)
- **Usuários**: agrupados por organização, busca, detalhes, resetar senha, mudar role
- **Financeiro**: extrato por org e período, exportar CSV
- **Precificação**: margem individual por engine, custo base editável, auto-recálculo
- **Segurança**: logs de tentativas de login com IP, email, status
- APIs: `/api/admin/*` (dashboard, organizations, plans, users, pricing, export, login-logs)

### Phase 5 — Wallet Integration (COMPLETA)

- `GET /api/me/wallet` — saldo da wallet do usuário/org
- Wallet check + dedução em 4 rotas de geração (generate, generate-image, scene-director, image-director)
- WalletPill no header do studio (color-coded por alertLevel)
- Saldo nunca vai negativo — bloqueia antes de gerar

### Pricing Table (COMPLETA)

- `src/lib/pricing.ts` — modelo PricingConfig + EnginePricing por engine
- Margem individual por engine (editável no Super Admin)
- Custo base auto-atualizado pela média das últimas 20 chamadas
- Preço do cliente = custo base × margem
- Creator vê preço do cliente (nunca o custo real do Segmind)
- Wallet cobra preço do cliente, não custo API
- `/api/pricing` — preços públicos para o studio
- `/api/admin/pricing` — gestão completa (Super Admin)

### Rate Limiting + Segurança (COMPLETA)

- `src/lib/rateLimit.ts` — rate limiting por IP e email
- 5 tentativas max em 15min, bloqueio de 30min após exceder
- Log de auditoria (últimos 500 eventos) no Redis
- `/api/admin/login-logs` — consulta logs (Super Admin)
- Aba Segurança no Super Admin com KPIs e tabela de logs

### BRL como padrão (COMPLETA)

- BRL ativo por padrão (showBrl=true)
- Auto-fetch da cotação no mount
- Todos os preços no studio em R$: seletores, custo, pill, atelier, feed
- Toggle R$ alterna entre BRL/USD
- Disclaimer com cotação em modais

### Filtro Meus/Equipe/Todos (COMPLETA)

- Dropdown "Exibindo:" na aba Assets
- Cenas e assets filtrados por createdBy
- Omni Reference não auto-carrega sheets de outros membros
- Máximo 3 refs injetadas por personagem (consistência)
- Library filtrada por ownership

### Character Sheet Generator (COMPLETA)

- Wizard de 3 passos no Atelier (não nos Assets)
- Gera 6 vistas: Frontal, ¾ Direita, Perfil, ¾ Esquerda, Costas, Close Rosto
- Regeneração individual por vista
- Upload de imagem de referência (sketch, foto)
- Engine selecionável (Nano Banana, Flux, Ideogram)
- Toggle estilo AAZ (clay/massinha)
- Salva como Character Sheet na biblioteca

### Cantigas — Produção completa de cantigas infantis (COMPLETA)

- **Modelo**: `src/lib/cantigas.ts` — Cantiga, CantigaCena, assets por cena
- **API CRUD**: `GET/POST /api/cantigas`, `GET/PATCH/DELETE /api/cantigas/[id]`
- **Suno API**: `POST /api/generate-music` — gera música via sunoapi.org (model V4)
  - Polling assíncrono (POST → taskId → GET status até SUCCESS)
  - Callback endpoint: `/api/webhooks/suno`
- **Lyrics Director**: `POST /api/lyrics-director` — Claude gera letras
  - System prompt otimizado para cantigas infantis cristãs PT-BR
  - Proibido direções de cena na letra (só texto cantável)
- **Storyboard Director**: modo 'storyboard' — divide letra em cenas
  - Personagens ATUAM (não cantam) — emoções pela física do corpo
  - Retorna ações em português (sem prompts)
- **Prompt Generator**: modo 'generate_prompt' — gera prompts em inglês
  - Inclui @image refs, character descriptions, clay texture, blocked words
  - Gerado APÓS o creator editar e aprovar as ações
- **UI**: aba 🎵 Cantigas no studio com wizard completo:
  - Dois modos: "Criar do zero" e "Dê vida à sua cantiga!" (upload)
  - Passo 1: Ideia + Letra (com controles: tempo, refrão, rima)
  - Passo 2: Música (Suno) com player e download
  - Passo 3: Roteiro Visual editável + "Aprovar e Gerar Prompts"
  - Passo 3.5: Preparação de assets guiada (fila um a um)
  - Passo 4: Produção com progresso, thumbnails, finalização
- **Persistência**: auto-save a cada passo no Redis
- **Minhas Cantigas**: lista com cards de progresso, "Continuar →"
- **Proteção de rota**: modal de aviso ao sair no meio da criação
- **"Gerar esta cena →"**: vai pro estúdio com prompt, personagens, @Image refs, duração

### Correções importantes

- First/last frame mutuamente exclusivo com Omni Reference no Seedance
- Prompt inclui @Video1 automaticamente para referência de vídeo
- Eventos registram preço do cliente (não custo Segmind)
- Team Leader não vê saldo Segmind (só Super Admin)
- Users sem org associados automaticamente no login

---

## PENDENTE / MELHORIAS FUTURAS

- **Cantigas**: recorte de áudio por cena (ffmpeg-wasm) para usar @Audio1 no Seedance
- **Cantigas**: vincular vídeos gerados de volta ao storyboard da cantiga
- **Custo real para imagens** (mesma abordagem saldo antes/depois do Segmind)
- **Email de boas-vindas** ao criar creator (Resend/SendGrid)
- **Integração Stripe/Hotmart** para billing automático
- **Chave Segmind por organização** (cliente traz sua própria key)
- **Self-service signup** (cliente se cadastra e paga sozinho)
- Reconciliação mensal (admin insere total cobrado pelo Segmind)

---

## VARIÁVEIS DE AMBIENTE

```bash
# Auth
SITE_PASSWORD=           # senha única de acesso
SESSION_SECRET=          # openssl rand -base64 32

# Segmind (server-side apenas — nunca expor no browser)
SEGMIND_API_KEY=         # sg-...
SEGMIND_VIDEO_ENDPOINT=https://api.segmind.com/v1/seedance-2.0

# Anthropic (Scene Director, Lyrics Director)
ANTHROPIC_API_KEY=       # sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# Suno (Cantigas — geração de música)
SUNO_API_KEY=            # chave do sunoapi.org

# Vercel KV (preenchido automaticamente ao conectar no painel)
KV_URL=
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_REST_API_READ_ONLY_TOKEN=

# Vercel Blob
BLOB_READ_WRITE_TOKEN=

# App
NEXT_PUBLIC_APP_URL=https://aaz-video-studio.vercel.app
```

---

## UNIVERSO AAZ COM JESUS

### Personagens (IDs canônicos)

| ID | Nome | Aparência |
|----|------|-----------|
| `abraao` | Abraão | ~8 anos, cabelo laranja-avermelhado bagunçado, pele clara com sardas, olhos verde-avelã, orelhas levemente salientes. Roupa: colete rosa sobre camiseta teal, shorts cargo cinza, tênis canvas verde-menta e branco. Postura: levemente inclinado para frente, sempre prestes a agir. |
| `abigail` | Abigail | ~7 anos, irmã do Zaqueu. Cabelo cacheado escuro em dois puffs laterais, pele morena quente, olhos castanhos grandes com cílios definidos, bochechas rosadas. Roupa: vestido multicamadas com estampa geométrica colorida, lenço colorido no pescoço, pulseiras de miçangas, sapatilhas vinho-rosa. A menor dos três. |
| `zaqueu` | Zaqueu | ~9 anos, irmão da Abigail. Mini-dreads textura argila, pele escura uniforme profunda, olhos castanhos expressivos, sorriso largo quando à vontade. Roupa: jaqueta verde-oliva aberta com botões dourados sobre camiseta laranja com estampa colorida, shorts geométrico azul/verde/laranja/rosa, tênis canvas colorido (amarelo/azul/rosa) com cadarço laranja. O mais alto dos três. |
| `tuba` | Tuba | Cachorro médio. Pelo âmbar-laranja intenso com textura de fibra de argila, pelo creme no peito e barriga, focinho preto arredondado, olhos castanho-escuros expressivos com sobrancelhas de argila articuladas independentemente, orelhas móveis floppy, cauda enrolada para cima. As sobrancelhas são o principal instrumento emocional do Tuba. |
| `theos` | Theos | **NUNCA aparece em cena.** Age apenas através de sinais ambientais físicos sutis: vento repentino, objeto caindo no momento certo, luz mudando, porta abrindo sozinha. Jamais descrever forma humana, asas, silhueta ou presença angelical. |
| `miriam` | Miriã | Adulta, mãe. Cabelo cacheado, frequentemente usa avental, olhos acolhedores. Guia por perguntas, nunca afirmações. Se abaixa ao nível das crianças quando a pergunta importa. |
| `elias` | Elias | Adulto, pai. Barba curta, mãos grandes, presença fisicamente calma. Fala pouco mas com impacto. Uma frase, declarativa, para. |

### Cenário principal — Clube da Aliança

Quintal da casa de Miriam e Elias. Cabana de madeira rústica com bandeira artesanal do clube, mesa de experimentos, caixas de materiais criativos espalhadas, árvore grande ao fundo. Luz natural de fim de tarde, sombras suaves, cores saturadas e convidativas.

### As 5 Regras da Aliança

1. Cuidamos uns dos outros
2. Falamos com amor
3. Compartilhamos o que temos
4. Perdoamos de verdade
5. Voltamos quando erramos

**Regra narrativa:** pelo menos uma regra precisa ser emocionalmente quebrada durante a cena. A resolução emerge da quebra — não apesar dela.

---

## ESTILO VISUAL OBRIGATÓRIO (para prompts Seedance)

```
Personagens 3D com textura de massinha e animação cinematográfica completamente fluida.
Superfície suave de argila na pele e roupas, acabamento artesanal ligeiramente rugoso
sugerindo figuras esculpidas à mão, olhos grandes expressivos com leve brilho de argila,
proporções arredondadas com bordas suaves, paleta quente, oclusão ambiente suave,
iluminação volumétrica, profundidade de campo cinematográfica.
Movimento contínuo e fluido, fluidez Pixar/DreamWorks — sem travamentos ou jerkiness.
CRÍTICO: textura de argila é instrução visual (aparência de superfície), NÃO instrução
de timing de animação. Movimento sempre fluido.
```

---

## VOCABULÁRIO BLOQUEADO NO SEEDANCE 2.0

Estes termos causam erro `"may contain restricted content"`.
**Nunca incluir nos prompts gerados — usar sempre a substituição:**

| Bloqueado | Usar em vez |
|-----------|-------------|
| angel, angels | winged boy, winged figure |
| wings (em humanoide) | feathered wings, large wings |
| God, Lord, Jesus, Holy Spirit | (nunca nomear diretamente no prompt) |
| pray, prayer | (descrever postura física: hands folded, eyes closed) |
| heaven, paradise | sky, star-filled sky |
| miracle | unexpected event |
| blessed, sacred, divine | warm, luminous, glowing |
| demon, devil | (evitar completamente) |
| church | building, large hall |
| Bible, scripture | book, old book |
| cross (religioso) | wooden structure |
| prophecy | mission, signal, sign |

**Exceção:** linhas de diálogo com vocabulário religioso ficam verbatim na seção
`Audio` do prompt — nunca na `Dynamic Description` ou `Static Description`.

---

## SCENE DIRECTOR — FORMATO DE OUTPUT

A rota `/api/scene-director` deve retornar exatamente:

```json
[
  { "lang": "pt-br", "prompt": "Estilo e Atmosfera: ... Descrição Dinâmica: ... Descrição Estática: ..." },
  { "lang": "es",    "prompt": "Estilo y Atmósfera: ... Descripción Dinámica: ... Descripción Estática: ..." },
  { "lang": "en",    "prompt": "Style & Mood: ... Dynamic Description: ... Static Description: ..." }
]
```

Cada prompt ≤ 1.800 caracteres. Sem markdown, sem comentários — só o JSON array.

Emoção = física do corpo. Proibido: "parece triste", "sente culpa".
Permitido: "maxilar aperta", "ombros caem", "olhar desvia".

---

## COMANDOS ÚTEIS

```bash
npm run dev          # desenvolvimento local → localhost:3000
npm run build        # build de produção (checar antes do deploy)
npx tsc --noEmit     # type-check sem compilar

# Primeiro push para o GitHub
git init
git add .
git commit -m "feat: fase 1 — scaffolding next.js + auth middleware"
git remote add origin https://github.com/alexandre/aaz-studio.git
git push -u origin main
```

---

## CONVENÇÃO DE COMMITS

```
feat: fase 2 — api routes segmind server-side
feat: fase 3 — vercel kv biblioteca compartilhada
feat: fase 4 — scene director claude api trilíngue
feat: fase 5 — deploy vercel configurado
fix: [descrição do bug]
chore: [dependências, config]
```

---

Contexto carregado. Pode começar pela Fase 2 ou qualquer outra fase.
