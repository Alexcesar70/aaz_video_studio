# AAZ STUDIO — BRIEFING PARA CLAUDE CODE

Você está trabalhando no **AAZ Studio**, um app Next.js 14 interno de produção
de cenas para o projeto de animação cristã infantil **AAZ com Jesus**.
Desenvolvedor: **Alexandre** (solo).

---

## O QUE JÁ EXISTE (Fase 1 — completa)

Estrutura Next.js 14 com App Router + TypeScript, já com:

- `src/middleware.ts` — auth JWT em todas as rotas (cookie `aaz_session`)
- `src/app/login/page.tsx` — tela de login com visual do projeto
- `src/app/studio/page.tsx` — rota protegida principal
- `src/components/AAZStudio.tsx` — UI completa ('use client'), todas as chamadas
  já apontam para `/api/*` (sem CORS, sem key exposta no browser)
- `src/app/api/auth/login/route.ts` — POST → verifica SITE_PASSWORD → cookie JWT 7d
- `src/app/api/auth/logout/route.ts` — POST → apaga cookie
- `src/app/api/generate/route.ts` — **STUB** proxy Segmind vídeo (implementar)
- `src/app/api/generate-sheet/route.ts` — **STUB** proxy Segmind sheet (implementar)
- `src/app/api/scene-director/route.ts` — **STUB** Claude trilíngue (implementar)
- `vercel.json` — timeouts 120s para rotas Segmind
- `.env.local` — variáveis configuradas

---

## FASES PENDENTES

### Fase 2 — API Routes server-side
Implementar os dois proxies Segmind. Os stubs já existem com o schema correto.

**`/api/generate/route.ts`** — já tem o fetch para o Segmind implementado.
Verificar: timeout, retry em 429, pass-through do blob de vídeo.

**`/api/generate-sheet/route.ts`** — já tem o fetch implementado.
Verificar: schema exato do endpoint `seedance-2.0-character`.

### Fase 3 — Vercel KV
Migrar a biblioteca de character sheets do `localStorage` para Vercel KV.
- Chave: `aaz:char:{character_id}`
- Compartilhada entre sessões (Alexandre acessa de qualquer máquina)
- Novo endpoint: `GET /api/library` e `DELETE /api/library/[id]`
- O componente `AAZStudio.tsx` carrega a biblioteca via fetch na montagem

### Fase 4 — Scene Director
Implementar `/api/scene-director/route.ts` com a Claude API.
- System prompt: o SKILL.md completo (ver seção abaixo)
- Modelo: `claude-sonnet-4-20250514`, `max_tokens: 4096`
- Retorna `[{lang: "pt-br", prompt}, {lang: "es", prompt}, {lang: "en", prompt}]`
- Nova aba "🎭 Scene Director" no AAZStudio.tsx:
  campo de texto livre + personagens selecionados → gera → injeta nas 3 abas de prompt

### Fase 5 — Deploy Vercel
- Push para GitHub → import no painel Vercel
- Configurar env vars (ver lista abaixo)
- Conectar Vercel KV (Storage tab)
- Verificar timeouts no `vercel.json`

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
