# ADR-0006 — Postgres + Drizzle ORM como durability layer do M3

- **Status:** accepted
- **Data:** 2026-04-14
- **Autor:** Alexandre (solo dev)

## Contexto

O estado atual depende 100% de Redis (Vercel KV → Upstash). Isso
funcionou bem no M1/M2 porque tudo que precisava durar era pequeno,
simples e mostly-read. A partir do M3 esse modelo começa a doer:

1. **Wallet/Transaction precisam ser ACID.** Debitar do saldo e
   registrar a transação em duas escritas separadas (mesmo com
   optimistic lock por `version`) deixa janela de inconsistência
   sob crash ou timeout serverless. Dinheiro pede WAL.
2. **Auditoria relacional fica cara.** Queries como "quantas cenas
   cada workspace gerou no último mês" exigem varrer dezenas de
   keys Redis; em SQL é uma linha.
3. **Integridade referencial de graça.** Hoje um delete de workspace
   deixa users órfãos sem ninguém avisar. FKs resolvem isso.
4. **Migrations versionadas.** Redis não tem migrations — mudanças
   de shape viram código imperativo one-off sem histórico.

## Decisão

Adotar **Postgres** gerenciado (Neon/Supabase/Vercel Postgres, TBD
pelo ops) como durability layer das entidades críticas:

- **Users** — substitui `aaz:user:*` no Redis
- **Workspaces** — substitui `aaz:org:*`
- **Wallets + Wallet Transactions** — substitui `aaz:wallet:*` e a
  sorted set de transações (ponto mais sensível da migração)
- **Projects** — substitui `aaz:project:*`
- **Episodes** — substitui `aaz:episode:*`

### O que FICA no Redis (por enquanto)

- **Jobs** (M2) — TTL nativo + volume alto justificam continuar.
- **Scenes** — volume + tamanho (videoUrl etc.); migração separada
  quando houver sinal de dor real.
- **ReferenceAsset** — idem; volume escala com uploads.
- **Activity events, cache de pricing, rate-limits** — Redis é o
  lugar certo pra isso.

### Stack escolhido

- **Drizzle ORM** — type-safe, migrações SQL-first, próximo ao Postgres
  raw. Preferido sobre Prisma por: (a) não precisar rodar um query
  engine em tempo de build, (b) migrations textuais são triviais de
  revisar, (c) fit melhor em serverless.
- **postgres-js (`postgres`)** — driver sem dependências nativas,
  funciona em Vercel Edge/Lambda sem setup extra.
- **drizzle-kit** — CLI de geração de migrations (`db:generate`) e
  sync rápido em dev (`db:push`).

### Estratégia de migração (por entidade)

Cada entidade segue o mesmo padrão, em PRs separados:

1. **Port + adapter Postgres** atrás da interface já existente.
   Ex.: `UserRepository` com `PostgresUserRepository` e
   `RedisUserRepository` como duas implementações.
2. **Feature flag** `USE_POSTGRES_{ENTITY}` controla qual adapter
   compõe em runtime. Default OFF — Redis continua sendo a verdade.
3. **Fase dual-write** opcional (quando for risco alto como
   Wallet): toda escrita vai pros dois stores. Leituras consultam
   Postgres primeiro, com fallback silencioso ao Redis se vazio.
   Divergências são logadas via `reportError`.
4. **Backfill script** one-off copia dados existentes do Redis
   pro Postgres, idempotente.
5. **Flag global ON por N dias** sem incidente.
6. **Consolidação** — remove o adapter Redis e a flag.

Ordem de PRs do M3 (da menos arriscada à mais):

1. **M3-PR1 (este PR)** — Drizzle setup + schemas + migrations.
2. **M3-PR2** — Users (dual-read via flag).
3. **M3-PR3** — Workspaces.
4. **M3-PR4** — Projects + Episodes.
5. **M3-PR5** — Wallet + Transactions (dual-write obrigatório; dinheiro).
6. **M3-PR6** — Sentry adapter concreto (fecha o loop do M2-PR8).
7. **M3-PR7** — Consolidação.

## Consequências

**Positivas:**

- Wallet fica ACID-safe. Spending + insert de transação num único
  `BEGIN/COMMIT` elimina a classe inteira de bugs de dupla-cobrança.
- Queries analíticas (admin dashboard, KPIs) ficam a 1 linha de SQL.
- Integridade referencial via FK evita dados órfãos.
- Migrations versionadas em `/drizzle/*.sql` — histórico reversível.
- Tests permanecem triviais (`InMemoryUserRepository` continua
  implementando `UserRepository`). Adapter Postgres tem seu próprio
  integration test, rodado no ambiente com DATABASE_URL setado.

**Negativas / trade-offs:**

- Mais um serviço gerenciado (Postgres provider). Custa dinheiro.
  Mitigado pelo free tier de Neon/Supabase no começo.
- Cold-start de conexão em serverless. Mitigado por `prepare:false`
  + `max:1` no driver, e por pool externo do provedor (Neon serverless
  driver é ideal).
- Complexidade de migration: precisamos coordenar deploy do
  código novo com criação de tabelas. Resolvido pelo fluxo:
  `db:push` rodado manualmente antes de ligar a flag.
- Durante dual-write, cada transação tem double-spend risk
  teórico (Redis commita, Postgres falha). Mitigado por registrar
  divergência via `reportError` e ter script de reconciliação noturno.

## Alternativas consideradas

- **Ficar em Redis só para sempre:** falha o requisito ACID do
  Wallet. Problema real, não hipotético.
- **Prisma ORM:** maior, mais opinativo, query engine em tempo de
  runtime. Drizzle é mais próximo do SQL e mais leve.
- **Supabase-RLS direto do browser:** tentador, mas acopla a auth
  à infraestrutura Supabase. Mantemos nossa camada de auth e só
  usamos Postgres como storage.
- **Kysely em vez de Drizzle:** Kysely é mais tipado ainda mas
  menor comunidade e sem schema-as-code nativo; perde pra Drizzle
  na experiência de migrations.

## Referências

- `src/db/schema/*.ts` — schemas por entidade.
- `src/db/client.ts` — singleton do driver.
- `drizzle/0000_*.sql` — migration inicial gerada.
- [Drizzle docs](https://orm.drizzle.team/)
- [postgres-js docs](https://github.com/porsager/postgres)
