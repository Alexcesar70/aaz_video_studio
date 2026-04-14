# AAZ Studio — Histórico pré-refactor universal

> Snapshot do estado do produto antes da refatoração para Creative
> Studio universal. Para o estado atual e roadmap, veja
> [`PROJECT.md`](../../PROJECT.md) e [`CLAUDE.md`](../../CLAUDE.md).
> Para recuperar a versão exata do código pré-refactor, faça checkout
> da tag `v0.0.1`.

---

## Identidade original

**AAZ Studio** era um app Next.js 14 interno de produção de cenas
para o projeto de animação cristã infantil **AAZ com Jesus**.
Desenvolvedor: **Alexandre** (solo).

A partir do M1 (branch `universal`, tag de partida `v0.0.1`), o
produto foi generalizado para **Creative Studio SaaS universal** —
agnóstico de universo narrativo. AAZ continua funcionando como um
tenant configurado, com seeds explícitos para personagens, estilo
clay e prompts de directors.

---

## Fases entregues antes do refactor

Lista resumida das fases de construção. Para detalhes completos, ver
o histórico do `CLAUDE.md` em commits anteriores ao PR #9 do M1
(`git log -- CLAUDE.md`).

### Fase 1 — Scaffolding + Auth
- Auth JWT via cookie `aaz_session`
- Login page com visual do projeto
- Studio rota protegida

### Fase 2 — API Routes Segmind
- Proxy multi-engine para vídeo (Seedance, Kling, Veo, Wan)
- Omni Reference, first/last frames, áudio
- Upload permanente do output ao Vercel Blob
- Captura de custo real via saldo Segmind antes/depois

### Fase 3 — Vercel KV / Biblioteca
- CRUD completo: assets, scenes, projects, episodes, scenarios, library

### Fase 4 — Scene Director + Image Director
- Claude API trilíngue (PT-BR + ES + EN)
- 6 moods de tom visual

### Fase 5 — Deploy Vercel
- CI automático via push em `main`
- Vercel KV + Vercel Blob

### Funcionalidades adicionais antes do refactor

- **Multi-user** com auth, roles (super_admin/admin/creator)
- **Activity tracking** com agregados diários
- **Admin Panel** com KPIs, gestão de users, fila de revisão de episodes
- **Budget caps** por creator com hard block
- **Episode delivery workflow**
- **Atelier** — criação de assets visuais
- **Custo real de vídeo** capturado por saldo Segmind antes/depois

### Multi-tenant Phases (1–6)
- Phase 1 — Org/Plan/Wallet models
- Phase 2 — Data isolation por organization
- Phase 3 — Super Admin Console `/admin`
- Phase 4 — Granular Permissions + Product Access
- Phase 5 — Wallet Integration
- Phase 6 — BRL Conversion Toggle + Exportable Statements

### Subsistemas

- **Pricing Table** — margem por engine, custo base auto-atualizado
- **Rate Limiting + Auditoria** de login
- **Filtro Meus/Equipe/Todos** em assets
- **Character Sheet Generator** (Atelier wizard 3 passos)
- **Cantigas** — produção completa de cantigas infantis (Suno + Lyrics
  Director + Storyboard Director + Prompt Generator)

---

## Universo AAZ (preservado nos seeds)

### Personagens canônicos (IDs)

| ID | Nome | Resumo |
|----|------|--------|
| `abraao` | Abraão | ~8 anos, cabelo laranja-avermelhado, colete rosa |
| `abigail` | Abigail | ~7 anos, cabelo cacheado em puffs, vestido geométrico |
| `zaqueu` | Zaqueu | ~9 anos, mini-dreads, jaqueta verde-oliva |
| `tuba` | Tuba | Cachorro âmbar-laranja, sobrancelhas expressivas |
| `theos` | Theos | Nunca aparece — sinais ambientais sutis |
| `miriam` | Miriã | Mãe, guia por perguntas |
| `elias` | Elias | Pai, fala pouco, presença calma |

Definição completa em
`src/modules/library/seeds/aazLeadCharacters.ts`.

### Cenário principal — Clube da Aliança

Quintal da casa de Miriam e Elias. Cabana de madeira rústica, mesa
de experimentos, árvore grande, fim de tarde dourado.

### As 5 Regras da Aliança

1. Cuidamos uns dos outros
2. Falamos com amor
3. Compartilhamos o que temos
4. Perdoamos de verdade
5. Voltamos quando erramos

**Regra narrativa:** uma regra precisa ser emocionalmente quebrada
durante a cena. Resolução emerge da quebra.

### Estilo visual obrigatório (preset `clay-massinha`)

```
Personagens 3D com textura de massinha e animação cinematográfica
fluida. Superfície suave de argila, acabamento artesanal, olhos
grandes expressivos com brilho de argila, paleta quente, oclusão
ambiente suave, iluminação volumétrica, fluidez Pixar/DreamWorks.

CRÍTICO: textura de argila é instrução visual, NÃO timing de animação.
Movimento sempre fluido.
```

### Vocabulário bloqueado no Seedance

| Bloqueado | Substituir por |
|-----------|---------------|
| angel, angels | winged boy, winged figure |
| wings (humanoide) | feathered wings |
| God, Lord, Jesus, Holy Spirit | (não nomear no prompt) |
| pray, prayer | (postura física: hands folded) |
| heaven, paradise | sky, star-filled sky |
| miracle | unexpected event |
| blessed, sacred, divine | warm, luminous, glowing |
| church | building, large hall |
| Bible, scripture | book, old book |
| cross (religioso) | wooden structure |

**Exceção:** linhas de diálogo com vocabulário religioso ficam
verbatim na seção `Audio` do prompt — nunca em `Dynamic Description`.

---

## Por que este histórico é separado

O `CLAUDE.md` original tinha 300+ linhas misturando regras
operacionais com histórico cronológico de implementação. A partir do
PR #9 do M1, separamos:

- **`PROJECT.md`** → o que o produto É (atemporal).
- **`CLAUDE.md`** → como TRABALHAR no código (regras + comandos).
- **`docs/adr/`** → POR QUÊ as decisões estruturais (com justificativa).
- **`docs/history/`** → o que JÁ FOI (este arquivo).
- **`docs/m1-rollout-checklist.md`** → COMO ATIVAR o que o M1 entregou.

Para conteúdo verbose das fases originais, use:

```bash
git show v0.0.1:CLAUDE.md
```
