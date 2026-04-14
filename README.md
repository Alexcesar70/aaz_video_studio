# Creative Studio

Multi-tenant SaaS de produção audiovisual com IA — vídeo, imagem, voz
e música — com workspaces colaborativos, bibliotecas reutilizáveis
(personagens, estilos, referências) e governança transparente de custo.

> **Status:** Milestone 1 (Agnostic Core) entregue na branch `universal`.
> Versão pré-refactor congelada na tag [`v0.0.1`](https://github.com/Alexcesar70/aaz_video_studio/releases/tag/v0.0.1).
> O **AAZ com Jesus** segue funcionando como tenant configurado da plataforma — ver `docs/history/AAZ_STUDIO_PRE_REFACTOR.md`.

---

## Onde começar

| Quero entender o produto | [`PROJECT.md`](./PROJECT.md) |
|---|---|
| Quero contribuir / regras de trabalho | [`CLAUDE.md`](./CLAUDE.md) |
| Quero entender decisões estruturais | [`docs/adr/`](./docs/adr/) |
| Quero ativar features do M1 em produção | [`docs/m1-rollout-checklist.md`](./docs/m1-rollout-checklist.md) |

---

## Stack

- **Next.js 14** (App Router + TypeScript)
- **Vercel** (deploy + KV/Redis + Blob storage)
- **Anthropic Claude** (Scene/Image/Lyrics Directors)
- **Segmind** (Seedance, Kling, Veo, Wan, Nano Banana Pro, Flux, Imagen)
- **ElevenLabs** (TTS, voice design, cloning)
- **Suno** (geração de música)
- **Vitest + Playwright** (unit + smoke E2E)

---

## Setup local

```bash
git clone https://github.com/Alexcesar70/aaz_video_studio.git
cd aaz_video_studio
npm install
cp .env.example .env.local   # se existir; senão preencha à mão
npm run dev                  # → http://localhost:3000
```

### Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `SESSION_SECRET` | JWT secret — gere com `openssl rand -base64 32` |
| `SITE_PASSWORD` | Senha do admin bootstrap (primeira inicialização) |
| `SEGMIND_API_KEY` | API Key Segmind |
| `SEGMIND_VIDEO_ENDPOINT` | Endpoint Segmind padrão (Seedance 2.0) |
| `ANTHROPIC_API_KEY` | Claude API |
| `ANTHROPIC_MODEL` | Default `claude-sonnet-4-20250514` |
| `ELEVENLABS_API_KEY` | Voice design + TTS + cloning |
| `SUNO_API_KEY` | Geração de música (sunoapi.org) |
| `KV_*` / `REDIS_URL` | Vercel KV (preenchido auto ao conectar storage) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (uploads) |
| `NEXT_PUBLIC_APP_URL` | Ex.: `http://localhost:3000` |

### Feature flags do M1 (todas default OFF)

| Flag | PR | O que liga |
|---|---|---|
| `FF_USE_DB_PROMPTS` | #3 | Directors leem do PromptTemplate em vez de constantes |
| `FF_USE_DB_ONLY_CHARACTERS` | #4 | `/api/assets` puramente DB-scoped (sem merge legado) |
| `FF_USE_STYLE_PROFILES` | #6 | Image Director usa StyleProfile entity |
| `FF_NEW_SIGNUP_WIZARD` | #7 | Login mostra wizard de criação de workspace |

Cada flag aceita rollout targetado:
- `FF_<FLAG>_USERS=id1,id2` — só esses usuários
- `FF_<FLAG>_WORKSPACES=ws1,ws2` — só esses workspaces
- `FF_<FLAG>=on` — global

Plano de rollout completo em [`docs/m1-rollout-checklist.md`](./docs/m1-rollout-checklist.md).

---

## Testes

```bash
npm run test           # Vitest — unitários do domínio (rápido)
npm run test:watch     # Vitest watch
npm run test:e2e       # Playwright smoke (requer dev server + env vars E2E_*)
npm run typecheck      # tsc --noEmit
```

**163 testes unitários** garantem o módulo de prompts, library
(characters + style profiles), workspaces e feature flags.

---

## Deploy

Push em `universal` (após M1 mergear) dispara deploy automático na
Vercel. Pré-merge em `main`, validar com a checklist de paridade
funcional listada no [`CLAUDE.md`](./CLAUDE.md).

`vercel.json` mantém timeout de 300s para rotas pesadas de geração.

---

## Convenção de commits

```
<type>(<escopo>): <descrição curta>

[contexto opcional do "porquê"]

[lista opcional de mudanças]

[caminho de rollout / como ligar feature flag]
```

Tipos: `feat`, `refactor`, `fix`, `chore`, `docs`, `test`, `perf`.

---

## Licença

Privado — uso interno.
