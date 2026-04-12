# 📚 Documentação — AAZ Studio

Bem-vindo à documentação oficial do **AAZ Studio**, o estúdio de produção
de vídeo AI do projeto **AAZ com Jesus** — uma animação cristã infantil
com personagens 3D de argila.

---

## O que é o AAZ Studio?

Uma plataforma web interna construída em Next.js 14 que permite ao diretor
do projeto (Alexandre) e a um time de criadores convidados produzir cenas,
personagens e episódios usando múltiplos motores de IA (Seedance 2.0,
Nano Banana Pro, Claude, Flux, Ideogram, etc), com controle de custo,
fluxo de aprovação e gestão de assets compartilhada.

```
                ┌─────────────────────────────────────────┐
                │          🎨  AAZ STUDIO                 │
                └─────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
    🎬 Estúdio            ✨ Atelier            📦 Assets
  (gera cenas)         (cria assets)        (gerencia)
        │                     │                     │
        └─────────┬───────────┴─────────┬──────────┘
                  │                     │
                  ▼                     ▼
              📤 Entrega            👑 Admin
           (upload MP4)         (dashboard + revisão)
```

---

## 📖 Índice

### [PRODUCT.md](./PRODUCT.md) — Manual do Produto (≈15 páginas)
**Para quem:** você como dono do produto, criadores do time, stakeholders
não-técnicos, investidores.

**O que tem:**
- Visão geral e público-alvo
- As 4 áreas do produto (Estúdio, Atelier, Assets, Admin) detalhadas
- 4 fluxos típicos de uso end-to-end
- Sistemas-chave em linguagem simples (moods, chain context, budget, aprovação)
- Roadmap e gaps conhecidos

### [ARCHITECTURE.md](./ARCHITECTURE.md) — Manual Técnico (≈10 páginas)
**Para quem:** desenvolvedores, você em modo técnico, Claude em sessões
futuras que precisem se situar.

**O que tem:**
- Stack + estrutura de pastas
- Sistemas transversais com detalhes de implementação
- Modelo de dados (Redis keys, Blob layout, tipos)
- API reference completa (30+ endpoints)
- Deploy & env vars

### [CHANGELOG.md](./CHANGELOG.md) — Timeline de commits (≈8 páginas)
**Para quem:** quem quer entender o histórico de decisões.

**O que tem:**
- Commits agrupados por fase (Fundação → Biblioteca → Workflow → Atelier → Admin)
- Cada fase com feats e fixes principais
- Commit hashes linkáveis

---

## 🚀 Links rápidos

- **Estúdio principal**: `src/components/AAZStudio.tsx` (~5000 linhas, o coração)
- **APIs**: `src/app/api/**` (30+ rotas)
- **Libs compartilhadas**: `src/lib/*` (users, auth, activity, budget, moods, videoEngines, imageEngines, assets, sceneDirectorSystem, imageDirectorSystem)
- **Deploy atual**: Vercel Pro (plano pago pra timeout 300s)
- **Storage**: Redis (node-redis via REDIS_URL) + Vercel Blob (vídeos, imagens, MP4 finais)
- **IAs integradas**: Segmind (vídeo + imagem, multi-motor) + Anthropic Claude (scene director + image director)

---

## 🎯 Ordem sugerida de leitura

**Se você é novo no produto:**
1. README.md (este) — 5 min
2. PRODUCT.md, seção 1 (Visão Geral) e seção 2 (Áreas) — 15 min
3. PRODUCT.md, seção 3 (Fluxos Típicos) — 10 min

**Se você vai desenvolver algo:**
1. README.md (este) — 5 min
2. ARCHITECTURE.md inteiro — 30 min
3. CHANGELOG.md — pra ver as decisões históricas relevantes

**Se você é stakeholder/investidor:**
1. PRODUCT.md, seções 1, 2 e 4 (Visão Geral + Áreas + Sistemas-Chave)

---

## 🔄 Manutenção

Esta documentação é **snapshot manual** do estado do produto. Não é
auto-gerada. A cada commit significativo, atualize o arquivo relevante
e o CHANGELOG.

Última atualização: abril de 2026 (commit `e240435`).
