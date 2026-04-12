# AAZ STUDIO — BRIEFING PARA CLAUDE CODE

**REGRA: sempre atualize este arquivo ao final de cada implementação.**

Você está trabalhando no **AAZ Studio**, um app Next.js 14 interno de produção
de cenas para o projeto de animação cristã infantil **AAZ com Jesus**.
Desenvolvedor: **Alexandre** (solo).

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

---

## PENDENTE / MELHORIAS FUTURAS

- Custo real para **imagens** (Segmind não retorna custo no response — mesma abordagem de saldo antes/depois)
- Custo real para **Claude** (ler `usage.input_tokens` + `usage.output_tokens` da resposta da API)
- Reconciliação mensal (campo no admin para inserir total cobrado pelo Segmind)
- Atualizar preços hardcoded em `videoEngines.ts` e `imageEngines.ts` quando Segmind mudar

---

## VARIÁVEIS DE AMBIENTE

```bash
# Auth
SITE_PASSWORD=           # senha única de acesso
SESSION_SECRET=          # openssl rand -base64 32

# Segmind (server-side apenas — nunca expor no browser)
SEGMIND_API_KEY=         # sg-...
SEGMIND_VIDEO_ENDPOINT=https://api.segmind.com/v1/seedance-2.0
SEGMIND_SHEET_ENDPOINT=https://api.segmind.com/v1/seedance-2.0-character

# Anthropic (Scene Director)
ANTHROPIC_API_KEY=       # sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# Vercel KV (preenchido automaticamente ao conectar no painel)
KV_URL=
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_REST_API_READ_ONLY_TOKEN=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_COST_PER_SEC=0.08
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
