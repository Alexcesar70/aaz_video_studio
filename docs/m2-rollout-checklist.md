# Milestone 2 — Rollout Checklist

> Plano para promover as **feature flags** do M2 em produção. Cada flag
> tem um caminho de canário → global → consolidação.
>
> Princípio: **uma flag por vez**, com 3–7 dias entre canário e global.
> Sem staging, então ordem sequencial e cuidadosa.

---

## Flags do M2

| Flag | PR | Backend | Frontend | Risco | Observabilidade |
|---|---|---|---|---|---|
| `USE_ASYNC_GENERATION` | M2-PR2 | sim | sim (Studio) | **ALTO** (fluxo de geração) | Inngest dashboard + `GET /api/jobs/:id` |

---

## Pré-requisitos antes de ligar `USE_ASYNC_GENERATION`

1. ✅ **Conta Inngest criada** com app `aaz-studio` conectado.
2. ✅ **Env vars configuradas na Vercel (Production):**
   - `INNGEST_EVENT_KEY` — permite o backend publicar eventos.
   - `INNGEST_SIGNING_KEY` — valida requests do Inngest ao webhook.
3. ✅ **Webhook registrado no Inngest:**
   ```
   https://aaz-video-studio.vercel.app/api/inngest
   ```
   Após deploy da `claude/session-...` (ou da branch mergeada em
   `universal`), o Inngest auto-detecta a função `video-generation-job`
   via PUT no webhook. Sync manual pelo dashboard se necessário.
4. ✅ **Smoke manual síncrono** (flag OFF) — gerar uma cena via Studio
   deve funcionar igual antes.
5. ✅ **Smoke manual polling** — chamar `GET /api/jobs/<id-inexistente>`
   deve retornar 404. Chamar com id válido deve retornar 200 com o job.

---

## Passo 1 — Canário só para Alexandre

```bash
# Vercel env (production):
FF_USE_ASYNC_GENERATION_USERS=alexandre
```

**Validar via Studio:**
1. Gerar uma cena Seedance de 5s com um personagem AAZ.
2. Abrir DevTools → Network → request `/api/generate` deve retornar
   `202` com `{ jobId, status: 'queued', async: true }`.
3. Observar requests periódicos a `/api/jobs/<id>` (polling a cada 2s).
4. Status bar no Studio deve mostrar "Processando em background (job
   abc12345)..." depois "Gerando vídeo...".
5. Job finaliza com `status: 'completed'` e `output.videoUrl` — vídeo
   aparece na tela, exatamente igual ao fluxo síncrono.
6. Inngest dashboard mostra a execução da função `video-generation-job`
   com steps: `mark-running` → `generate-video` → `mark-completed`.
7. Activity feed do admin dashboard recebe o evento `scene_generated`
   (o usecase `generateVideo` continua emitindo — sem mudança).
8. Wallet deduz valor correto (uma cobrança, não duplicada).

**Sinais de sucesso (24h):**
- [ ] Nenhuma cena ficou travada em `queued` ou `running`.
- [ ] TTL de 30 dias dos jobs terminais funciona (Redis `aaz:job:*`
      com TTL configurado em completed/failed).
- [ ] Budget check + wallet deduction ainda acontecem exatamente 1x por job.

**Rollback imediato se quebrar:**
```bash
FF_USE_ASYNC_GENERATION_USERS=  # limpa
# Nada mais é necessário — rota volta a chamar generateVideo inline.
```

---

## Passo 2 — Rollout global

Após 3–7 dias sem incidente:

```bash
FF_USE_ASYNC_GENERATION=on
# (remove FF_USE_ASYNC_GENERATION_USERS — fica redundante)
```

**Monitoramento:**
- Inngest dashboard: taxa de sucesso > 98%, tempo médio < 60s.
- Redis: número de chaves `aaz:job:*` cresce e estabiliza (TTL faz a
  limpeza).
- `/api/jobs/:id` latência p99 < 200ms.

**Rollback global:**
```bash
FF_USE_ASYNC_GENERATION=off  # volta ao síncrono global
```

---

## Passo 3 — Consolidação (futuro M2-PR8)

Após 30+ dias em `on` sem incidente:

1. Remover branch síncrono em `/api/generate` — todas as chamadas
   passam pela fila.
2. Remover lógica "se jobId, poll" no frontend: sempre assume async.
3. Remover `USE_ASYNC_GENERATION` da união `FeatureFlag` e das env
   vars da Vercel.
4. Remover `createVideoProvider` + `createVideoStorage` inline no
   controller — eles vivem só dentro da função Inngest.

**NÃO remover** o módulo `jobs` — ele é a base para futuros kinds
(imagem, música, voz).

---

## Ordem de expansão do M2 (posterior a esta flag)

| PR | Escopo | Depende de |
|---|---|---|
| M2-PR3 | ReferenceAsset como entidade | M2-PR1 |
| M2-PR4 | Asset Picker unificado | M2-PR3 |
| M2-PR5 | Character como entidade + versionamento | — |
| M2-PR6 | StyleProfile versionamento (UI) | M1-PR5 |
| M2-PR7 | Decomposição `AAZStudio.tsx` | — |
| M2-PR8 | Consolidação + Sentry | M2-PR2..PR7 |

Cada PR terá sua própria seção nesta doc quando for entregue.

---

## Sumário visual

```
[deploy M2-PR1] ──── jobs foundation (zero comportamento mudado)
       │
       ▼
[deploy M2-PR2] ──── Inngest instalado; flag OFF
       │
       ▼
[Inngest webhook registrado] ── dashboard mostra função
       │
       ▼
[canário: FF_USE_ASYNC_GENERATION_USERS=alexandre] (24h)
       │
       ▼
[global: FF_USE_ASYNC_GENERATION=on] (3-7 dias)
       │
       ▼
[30 dias sem incidente]
       │
       ▼
[PR de consolidação — remove branch síncrono]
```
