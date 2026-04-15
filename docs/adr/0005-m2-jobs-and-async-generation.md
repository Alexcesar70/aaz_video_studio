# ADR-0005 — Jobs module e geração assíncrona via Inngest

- **Status:** accepted
- **Data:** 2026-04-14
- **Autor:** Alexandre (solo dev)

## Contexto

O M1 entregou as bases do refactor universal com rotas síncronas
(`/api/generate` chama Segmind inline e retorna o vídeo no mesmo
request). Isso bate de frente com duas restrições reais:

1. **Timeout de 300s da Vercel.** Gerações de vídeo de 10–15s com o
   Seedance 2.0 flertam com esse limite — qualquer fila no provider
   derruba o request antes de salvar no Blob.
2. **UX ruim com bloqueio longo.** Um request síncrono de 60–120s
   sem feedback granular é péssimo: o usuário não sabe se o processo
   quebrou ou só está demorando.

Além disso, o M2 prevê novas kinds de geração (música, voz, imagens
batch) que terão tempos de execução variáveis. Precisávamos de uma
**foundation genérica** de jobs assíncronos, não uma solução ad-hoc
pra vídeo.

## Decisão

Adotar um **modelo de Job** desacoplado do motor de execução, com
Clean Architecture:

### 1. Módulo `@/modules/jobs` — domínio puro

- `Job` entity com grafo de estados validado
  (`queued → running → completed|failed`, `queued → canceled`).
- `JobRepository` port (implementações Redis + InMemory).
- `JobRunner` port que apenas "enfileira" — não executa. Execução
  acontece fora, num worker durável que chama de volta via use cases
  (`markRunning`, `markCompleted`, `markFailed`).

### 2. Adapter Inngest como `JobRunner` de produção

- Inngest: plataforma serverless de durable execution. Gratuita até
  50k execuções/mês, perfeita pra o volume atual.
- `InngestJobRunner` depende apenas de uma interface mínima
  `InngestLikeClient` (método `send`) — permite testes sem mockar o
  SDK e troca futura (SQS, Temporal, etc.).
- Função Inngest para vídeo usa 3 steps (`mark-running` →
  `generate-video` → `mark-completed`), permitindo retry de steps
  individuais sem refazer upload no Blob nem duplicar cobrança da
  wallet.

### 3. Rota `/api/generate` com dupla-pilha

- Flag OFF (default): comportamento síncrono histórico, 100% intacto.
- Flag ON: enfileira job, retorna `202 { jobId, status: 'queued' }`.
- Frontend detecta `jobId` e faz polling via `/api/jobs/:id`
  (helper puro em `src/lib/jobPolling.ts` — sem React, reusável).

### 4. TTL em Jobs terminais

- Redis `aaz:job:*` ganha TTL de 30 dias ao transitar pra
  `completed|failed|canceled`. Preserva histórico operacional sem
  crescer indefinidamente.

### 5. Error reporting abstrato

- `src/lib/errorReporter.ts` — abstração leve (`reportError`,
  `reportMessage`) com `ConsoleErrorReporter` default. Swap por
  Sentry/Axiom/Datadog em instrumentation.ts quando DSN estiver
  configurado.
- Call sites chamam `reportError(err, { tags, extra, fingerprint })`
  e jogam o erro em log estruturado JSON — fácil de agregar por log
  shipper.

## Consequências

**Positivas:**

- **Zero risco de regressão na ligação da flag:** rotas síncronas
  permanecem até a consolidação. Rollback é uma env var.
- **Abre caminho pra novas kinds sem retrabalho:** Image/Music/Voice
  vão reutilizar a mesma infra. Só precisam registrar sua função
  Inngest e mapear evento em `JOB_EVENT_NAMES`.
- **Tests ficam honestos:** `InMemoryJobRepository` + `NoopJobRunner`
  permitem validar use cases sem infra externa. `RecordingJobRunner`
  e `InngestLikeClient` mockável cobrem o adapter.
- **Observabilidade pronta:** abstração de error reporter desacopla
  vendor, e logs estruturados JSON são plug-and-play.

**Negativas / trade-offs:**

- **Dependência externa nova (Inngest).** Ainda que o free tier seja
  generoso, é mais um serviço na caixa-preta de dependências. Risco
  mitigado pela abstração `JobRunner` — trocar de vendor é um só
  arquivo.
- **Setup operacional antes de ligar a flag:** INNGEST_EVENT_KEY +
  SIGNING_KEY precisam estar configuradas na Vercel, e o webhook
  `/api/inngest` registrado no dashboard. Documentado no rollout
  checklist.
- **Custos em dobro durante o dual-path:** enquanto a flag convive
  sincrono+async, carregamos ambos no bundle. Resolvido na
  consolidação (remoção do branch síncrono).

## Alternativas consideradas

- **Pular Inngest e usar QStash/BullMQ/SQS:** QStash é similar mas
  menos ergonômico em funções duráveis (sem `step.run`). BullMQ exige
  Redis de alta disponibilidade + worker próprio (não combina com
  serverless). SQS+Lambda adiciona AWS-ismos desnecessários pra um
  solo dev.
- **Manter síncrono e aumentar timeout da Vercel:** timeout fica em
  300s (plano pro atual); mesmo assim não elimina o problema de UX.
- **Polling no `/api/generate` (long-poll HTTP 202 + 303):** tecnicamente
  funciona mas não resolve o timeout — o fetch inicial ainda dura até
  `completed`.

## Referências

- `src/modules/jobs/` — módulo completo.
- `src/inngest/functions/videoGeneration.ts` — função durável.
- `docs/m2-rollout-checklist.md` — procedimento de rollout.
- [Inngest docs](https://www.inngest.com/docs)
