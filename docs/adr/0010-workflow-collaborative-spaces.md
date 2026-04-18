# ADR-0010: Workflow — Espaço Colaborativo Visual

**Status:** Planejado
**Data:** 2026-04-18
**Decisor:** Alexandre

## Contexto

O BearStudio precisa de um espaço de trabalho visual e colaborativo
onde criadores possam planejar, organizar referências, escrever prompts,
gerar imagens/vídeos, e trabalhar em equipe — tudo num canvas interativo
com nós conectáveis.

Inspiração principal: **Figma (boards/whiteboard)** + **Freepik Spaces**
+ **Miro (nós e conexões)**.

Esse é o módulo mais complexo do produto. Requer planejamento cuidadoso
antes de implementar.

## Decisão

### O que é o Workflow

Um canvas visual onde o usuário (solo ou em time) organiza o processo
criativo inteiro — do brainstorm ao vídeo final. Cada elemento no
canvas é um **nó** com tipo, conteúdo e conexões.

### Tipos de Nó

| Tipo | Ícone | O que contém | Ações |
|------|-------|-------------|-------|
| **Nota** | 📝 | Texto livre (ideia, briefing, anotação) | Editar, colorir, redimensionar |
| **Imagem** | 🖼️ | Upload ou gerada via Image Director | Upload, gerar, editar prompt |
| **Vídeo** | 🎬 | Cena gerada via BearStudio | Gerar, preview, abrir no Studio |
| **Personagem** | 👤 | Link pra Character asset | Arrastar da biblioteca |
| **Cenário** | 🏞️ | Link pra Scenario asset | Arrastar da biblioteca |
| **Referência** | 🔗 | URL, imagem externa, screenshot | Colar URL, upload |
| **Prompt** | ✍️ | Prompt pra geração (com SmartPrompter) | Editar, refinar, gerar |
| **Áudio** | 🎵 | Música (Cantigas) ou voz (Senoide) | Gerar, preview, atribuir |
| **Grupo** | 📦 | Container que agrupa outros nós | Agrupar/desagrupar, nomear |
| **Tarefa** | ✅ | Atribuição pra membro do time | Atribuir, deadline, status |

### Layout do Canvas

```
┌──────────────────────────────────────────────────────┐
│ 🔄 Workflow · Campanha Maio                    [👥3] │
│ [🔍 Buscar] [+ Nó] [📦 Agrupar] [🎯 Minhas tarefas]│
├──────────────────────────────────────────────────────┤
│                                                      │
│   ┌────────┐     ┌────────┐     ┌────────┐          │
│   │📝 Brief│────→│👤 Julia│────→│🎬 Cena1│          │
│   │        │     │  na    │     │        │          │
│   └────────┘     └────────┘     └────┬───┘          │
│                                      │              │
│   ┌────────┐     ┌────────┐     ┌────↓───┐          │
│   │🖼️ Ref  │────→│🏞️ Acad │────→│🎬 Cena2│          │
│   │ visual │     │  emia  │     │        │          │
│   └────────┘     └────────┘     └────┬───┘          │
│                                      │              │
│                  ┌────────┐     ┌────↓───┐          │
│                  │🎵 Trilha│────→│🎬 Cena3│          │
│                  │ sonora │     │        │          │
│                  └────────┘     └────────┘          │
│                                                      │
│   ┌─────────────────────────────────┐               │
│   │ 📦 GRUPO: Assets da campanha    │               │
│   │  👤 Juliana  🏞️ Academia  🎵 BGM│               │
│   └─────────────────────────────────┘               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Interações Core

**Solo:**
- Drag-and-drop nós no canvas (posicionamento livre)
- Conectar nós com setas (relações visuais)
- Zoom + pan infinito
- Double-click pra editar conteúdo do nó
- Right-click → menu contextual (deletar, duplicar, converter tipo)
- Arrastar assets da Library pro canvas (cria nó automaticamente)
- Gerar direto no canvas (seleciona nó Prompt → SmartPrompter → gerar)

**Time:**
- Cursores de outros membros visíveis (real-time, tipo Figma)
- Nós de Tarefa atribuíveis a membros
- Comentários em qualquer nó (thread)
- Status por nó: pendente → em progresso → pronto → aprovado
- Notificações quando tarefa é atribuída ou comentada
- Permissões: Owner/Manager editam tudo, Creator edita só seus nós

### Arquitetura Técnica

```
src/modules/workflow/
  domain/
    Node.ts              — entidade nó (tipo, posição, conteúdo, conexões)
    Board.ts             — entidade board (canvas, nós, membros)
    Connection.ts        — ligação entre nós (source → target)
  ports/
    BoardRepository.ts   — persistência de boards
    NodeRepository.ts    — persistência de nós
  usecases/
    createBoard.ts
    addNode.ts
    moveNode.ts
    connectNodes.ts
    assignTask.ts
    commentOnNode.ts
  infra/
    RedisBoardRepository.ts
    RedisNodeRepository.ts

src/app/api/workflow/
  boards/route.ts           — CRUD de boards
  boards/[id]/route.ts      — board detail
  boards/[id]/nodes/route.ts — CRUD de nós
  boards/[id]/nodes/[nodeId]/route.ts

src/components/studio/
  WorkflowCanvas.tsx        — componente principal do canvas
  WorkflowNode.tsx          — renderizador de nó individual
  WorkflowToolbar.tsx       — barra de ferramentas
  WorkflowMinimap.tsx       — minimapa de navegação

src/app/(workspace)/workflow/
  page.tsx                  — lista de boards
  [id]/page.tsx             — canvas do board
```

### Dependências Técnicas

| Necessidade | Opções | Recomendação |
|-------------|--------|-------------|
| Canvas rendering | react-flow, @xyflow/react, fabric.js, custom SVG | **@xyflow/react** — nós + conexões + zoom + minimap built-in |
| Drag-and-drop | @dnd-kit, react-beautiful-dnd, native DnD | **@dnd-kit** — modular, performante |
| Real-time sync | WebSocket, Liveblocks, Yjs, Supabase Realtime | **Liveblocks** (futuro) ou **polling** (MVP) |
| Persistência | Redis (nós como JSON) | Redis (MVP), Postgres (escala) |

### Fases de Implementação

**Fase 1 — Canvas Básico (MVP solo)**
- Board CRUD
- Nós: Nota, Imagem, Vídeo, Referência
- Posicionamento livre (drag)
- Conexões visuais (setas)
- Zoom + pan
- Sem real-time (salva no Redis, carrega do Redis)
- Estimativa: 3-4 semanas

**Fase 2 — Integração com Studio**
- Nós de Prompt → SmartPrompter → gerar
- Nós de Personagem/Cenário → arrastar da Library
- Nó de Vídeo → gerar via BearStudio inline
- Spielberg disponível como sidebar no canvas
- Estimativa: 2-3 semanas

**Fase 3 — Colaboração**
- Cursores de membros (Liveblocks ou WebSocket)
- Nós de Tarefa com atribuição + deadline
- Comentários em thread por nó
- Notificações
- Estimativa: 4-6 semanas

**Fase 4 — Polish**
- Minimapa
- Templates de board (storyboard, brainstorm, planning)
- Export do board (PDF, imagem)
- Undo/redo
- Keyboard shortcuts
- Estimativa: 2-3 semanas

### Entidades Core

```typescript
interface Board {
  id: string
  name: string
  workspaceId: string
  createdBy: string
  nodes: Node[]
  connections: Connection[]
  viewport: { x: number; y: number; zoom: number }
  createdAt: string
  updatedAt: string
}

interface Node {
  id: string
  type: 'note' | 'image' | 'video' | 'character' | 'scenario'
       | 'reference' | 'prompt' | 'audio' | 'group' | 'task'
  position: { x: number; y: number }
  size: { width: number; height: number }
  content: Record<string, unknown>  // varia por tipo
  assignedTo?: string    // userId (pra tasks)
  status?: 'pending' | 'in_progress' | 'ready' | 'approved'
  color?: string
  parentGroupId?: string
  createdBy: string
  createdAt: string
}

interface Connection {
  id: string
  sourceNodeId: string
  targetNodeId: string
  label?: string
}
```

## Consequências

### Positivas
- Diferenciador competitivo enorme — nenhum concorrente tem canvas + geração IA
- Unifica planejamento e execução no mesmo espaço
- Natural pra trabalho em equipe (agências)
- Spielberg + SmartPrompter podem ser plugados nos nós

### Negativas
- Módulo mais complexo do produto inteiro
- Canvas interativo é heavy em performance (muitos nós = lag)
- Real-time collaboration é caro (Liveblocks = $$$, WebSocket = infra)
- UX de canvas é difícil de acertar (Figma levou anos)

### Trade-offs
- MVP sem real-time (polling a cada 5s) → adicionar real-time depois
- Começar com poucos tipos de nó (Nota + Imagem + Vídeo) → expandir
- Canvas 2D simples (sem 3D, sem layers) → suficiente pro caso de uso
- @xyflow/react reduz 80% do esforço de canvas vs custom
