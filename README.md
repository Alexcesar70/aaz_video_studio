# AAZ com Jesus · Production Studio

Studio interno de produção de cenas para o projeto de animação cristã infantil **AAZ com Jesus**, usando Seedance 2.0 via Segmind.

**Time:** Alexandre

---

## Stack

- **Next.js 14** — App Router + TypeScript
- **Vercel** — Deploy + KV (biblioteca de character sheets compartilhada)
- **Segmind** — Seedance 2.0 (geração de vídeo + character sheets)
- **Anthropic Claude** — Scene Director trilíngue (PT-BR + ES + EN)
- **Auth** — Middleware com cookie JWT + senha única em `.env.local`

---

## Setup local

### 1. Clone e instale

```bash
git clone https://github.com/seu-org/aaz-studio.git
cd aaz-studio
npm install
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite `.env.local` com os valores reais:

| Variável | Descrição |
|----------|-----------|
| `SITE_PASSWORD` | Senha de acesso ao estúdio (compartilhada entre Raphael, Marco, Carpes) |
| `SESSION_SECRET` | String aleatória ≥ 32 chars — gere com `openssl rand -base64 32` |
| `SEGMIND_API_KEY` | API Key Segmind — [segmind.com/dashboard](https://segmind.com/dashboard/api-keys) |
| `ANTHROPIC_API_KEY` | API Key Anthropic — [console.anthropic.com](https://console.anthropic.com/api-keys) |
| `KV_*` | Preenchido automaticamente ao conectar Vercel KV (Fase 3) |

### 3. Rode localmente

```bash
npm run dev
```

Acesse `http://localhost:3000` → redireciona para `/login` → use a senha do `.env.local`.

---

## Estrutura do projeto

```
src/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Redirect → /studio
│   ├── globals.css
│   ├── studio/
│   │   └── page.tsx            # Página principal (protegida)
│   ├── login/
│   │   └── page.tsx            # Página de login
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts  # POST — verifica senha, seta cookie JWT
│       │   └── logout/route.ts # POST — apaga cookie
│       ├── generate/
│       │   └── route.ts        # POST — proxy Segmind vídeo (Fase 2)
│       ├── generate-sheet/
│       │   └── route.ts        # POST — proxy Segmind character sheet (Fase 2)
│       └── scene-director/
│           └── route.ts        # POST — Claude trilíngue (Fase 4)
├── components/
│   └── AAZStudio.tsx           # Componente principal ('use client')
├── lib/
│   └── (utilities Fase 3+)
└── middleware.ts               # Auth por cookie em todas as rotas
```

---

## Fases de desenvolvimento

| Fase | Responsável | Status | Descrição |
|------|------------|--------|-----------|
| 1 | Alexandre | ✅ Completa | Scaffolding Next.js, auth middleware, página login |
| 2 | Alexandre | ⬜ Pendente | Implementar `/api/generate` e `/api/generate-sheet` |
| 3 | Alexandre | ⬜ Pendente | Vercel KV para biblioteca compartilhada |
| 4 | Alexandre | ⬜ Pendente | Scene Director — Claude API + SKILL.md |
| 5 | Alexandre | ⬜ Pendente | Deploy Vercel + env vars + KV connect |

---

## Deploy no Vercel (Fase 5)

```bash
# 1. Push para o GitHub
git push origin main

# 2. No painel Vercel: Import Project → seleciona o repo

# 3. Adicionar as variáveis de ambiente no painel Vercel
#    Settings → Environment Variables → adicionar todas do .env.example

# 4. Conectar Vercel KV
#    Storage → Create Database → KV → conectar ao projeto
#    (as variáveis KV_* são preenchidas automaticamente)

# 5. Deploy automático em cada push para main
```

### Timeout das funções

Configurado em `vercel.json`:
- `/api/generate` — 120s (Segmind pode demorar para vídeos longos)
- `/api/generate-sheet` — 120s
- `/api/scene-director` — 30s

---

## Auth

O middleware em `src/middleware.ts` intercepta **todas** as rotas exceto `/login` e `/api/auth/*`.

- Verifica o cookie `aaz_session` (JWT assinado com `SESSION_SECRET`)
- Cookie expira em 7 dias
- Em produção o cookie é `httpOnly + secure + sameSite=lax`
- Logout em qualquer tela pelo botão "Sair" no header

---

## Personagens canônicos

| ID | Nome | Aparência |
|----|------|-----------|
| `abraao` | Abraão | Cabelo laranja-avermelhado, pele clara, sardas, olhos verde-avelã |
| `abigail` | Abigail | Cabelo cacheado escuro em puffs, pele morena, olhos castanhos grandes |
| `zaqueu` | Zaqueu | Mini-dreads, pele escura uniforme, o mais alto dos três |
| `tuba` | Tuba | Cachorro âmbar-laranja, pelo textura argila, sobrancelhas expressivas |
| `theos` | Theos | NUNCA aparece em cena — age apenas pelo ambiente |
| `miriam` | Miriã | Adulta, cabelo cacheado, avental, olhos acolhedores |
| `elias` | Elias | Adulto, barba curta, mãos grandes, presença calma |

---

## Vocabulário bloqueado no Seedance

Os seguintes termos causam erro `"may contain restricted content"`. **Nunca incluir nos prompts gerados:**

| Bloqueado | Substituir por |
|-----------|---------------|
| angel, angels | winged boy, winged figure |
| God, Lord, Jesus | (omitir no prompt — usar apenas no Audio) |
| pray, prayer | hands folded, eyes closed (física apenas) |
| church | building, large hall |
| Bible | book, old book |
| cross | wooden structure |
| heaven | sky, star-filled sky |
| miracle | unexpected event |
| blessed, sacred | warm, luminous, glowing |
