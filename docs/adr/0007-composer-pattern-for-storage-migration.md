# ADR-0007 — Composer pattern para migração progressiva de storage

- **Status:** accepted
- **Data:** 2026-04-15
- **Autor:** Alexandre (solo dev)

## Contexto

Os Milestones M3 (Postgres adapters), M4 (wiring inicial) e M5
(wiring expansion) consolidaram um padrão recorrente: cada entidade
crítica precisa coexistir em DOIS stores durante a transição
Redis→Postgres, e a escolha de qual usar precisa ser:

- Controlável por flag (canário, kill-switch).
- Independente por contexto (user-targeted, workspace-targeted).
- Substituível (Postgres não é a verdade absoluta — voltar pra
  Redis precisa ser instantâneo).
- Testável (sem precisar de Postgres real nos testes unit).

A solução emergente — chamada aqui de **composer pattern** — virou
infraestrutura de fato. Este ADR documenta a forma definitiva pra
servir de molde quando uma entidade nova precisar migrar entre
stores.

## Decisão

Cada entidade crítica que vive em mais de um store concreto adota
**4 camadas** com responsabilidades específicas:

### 1. Domain (puro, agnóstico de infra)

```
src/modules/<entidade>/domain/<Entity>.ts
```

- Entity TypeScript + `validate<Entity>(input)` puro.
- Erros tipados: `Invalid<Entity>Error`, `<Entity>NotFoundError`.
- Mutators puros: `bumpVersion`, `fork`, transitions.
- **Zero** import de Redis/Postgres/Drizzle/getRedis/getDb.

### 2. Port (contrato)

```
src/modules/<entidade>/ports/<Entity>Repository.ts
```

- Interface `<Entity>Repository` com métodos `findById`, `list`,
  `upsert`, `remove`, etc.
- Filter types tipados (`<Entity>ListFilter`).
- Sem implementação. Define o que TODO adapter precisa expor.

### 3. Adapters (3 sempre, opcional 4)

```
src/modules/<entidade>/infra/
├── InMemory<Entity>Repository.ts   # testes
├── Redis<Entity>Repository.ts      # legado / fonte da verdade durante migração
├── Postgres<Entity>Repository.ts   # destino da migração (pode usar lazy db getter)
└── DualWrite<Entity>Repository.ts  # opcional — compõe primary + shadow para fan-out
```

- **InMemory** é o canônico de testes; espelha invariantes (unique
  email, unique slug, etc.) que o Postgres enforca via constraints.
- **Redis** envolve as chaves legadas direto, não importa
  `@/lib/<entity>` quando puder evitar (lógica complexa de hash,
  validação, etc. fica no caminho legado para não ser duplicada).
- **Postgres** usa Drizzle, com `_injectedDb?: Db` lazy resolution
  no constructor — permite construir o repo em ambientes sem
  `DATABASE_URL` (o `getDb()` só roda no primeiro uso).
- **DualWrite** é opcional, usado quando o write precisa ir pra
  dois stores em paralelo durante a transição (Wallet é o caso
  canônico — dinheiro). Erros no shadow vão pra `reportError`,
  nunca propagam.

### 4. Composer

```
src/modules/<entidade>/composer.ts
```

```ts
export function select<Entity>Repo(
  context: FeatureFlagContext = {},
): <Entity>Repository {
  return isFeatureEnabled('USE_POSTGRES_<ENTITY>', context)
    ? new Postgres<Entity>Repository()
    : new Redis<Entity>Repository()
}
```

Para entidades com dual-write (Wallet):

```ts
export function selectWalletRepo(
  context: FeatureFlagContext = {},
): WalletRepository {
  const usePg = isFeatureEnabled('USE_POSTGRES_WALLET', context)
  const dualWrite = isFeatureEnabled('USE_POSTGRES_WALLET_DUAL_WRITE', context)
  if (usePg) {
    return new DualWriteWalletRepository(
      new PostgresWalletRepository(), // primary
      new RedisWalletRepository(),    // shadow
    )
  }
  if (dualWrite) {
    return new DualWriteWalletRepository(
      new RedisWalletRepository(),    // primary (lê)
      new PostgresWalletRepository(), // shadow (recebe escritas)
    )
  }
  return new RedisWalletRepository()
}
```

### Wiring nas rotas

Routes não escolhem adapter — chamam `selectXxxRepo(context)`:

```ts
const repo = selectUserRepo({ userId: admin.id, workspaceId: orgId })
const users = await listUsers({ repo })
```

Para writes de wallet (que precisam de wiring em vários surfaces),
existe um helper centralizado em `src/lib/walletWiring.ts` que
encapsula `selectWalletRepo` + use case num único call:

```ts
await composedSpendCredits({
  walletId, amountUsd, reason, metadata,
  actorUserId: user.id, workspaceId: user.organizationId,
})
```

## Estado atual (ao fim do M5)

| Entidade | InMemory | Redis | Postgres | DualWrite | Composer | Wired |
|---|---|---|---|---|---|---|
| Users | ✓ | ✓ | ✓ | — | ✓ | reads (M4-PR2) |
| Workspaces | ✓ | ✓ | ✓ | — | ✓ | admin GET (M4-PR3) |
| Wallet | ✓ | ✓ | ✓ | ✓ | ✓ | reads (M4-PR4) + writes (M5-PR3) |
| Projects | ✓ | ✓ | ✓ | — | ✓ | reads (M5-PR2) |
| Episodes | ✓ | ✓ | ✓ | — | ✓ | reads (M5-PR2) |
| Jobs | ✓ | ✓ | — | — | — | sempre Redis |
| References | ✓ | ✓ | — | — | — | sempre Redis |
| Characters | ✓ | ✓ | — | — | — | sempre Redis |
| StyleProfile | ✓ | ✓ | — | — | — | sempre Redis |
| Playbooks | ✓ | ✓ | — | — | — | sempre Redis (entidade nova M5) |
| PromptTemplate | ✓ | ✓ | — | — | — | sempre Redis |

Nem toda entidade vai pra Postgres — só as que justificam ACID
(Wallet) ou queries relacionais não-triviais (Users, Workspaces,
Projects, Episodes). Volume baixo + acesso oportunista (Jobs,
References, Characters, etc.) ficam em Redis.

## Consequências

**Positivas:**

- Adicionar entidade nova segue template fechado — sem reinventar
  storage layer.
- Migração de storage não bloqueia features novas: o composer
  isola decisão "qual adapter" do call site.
- Tests rodam 100% sem Postgres/Redis (basta InMemory).
- Rollback de qualquer migração é uma env var.
- Dual-write obrigatório para dinheiro evita perda silenciosa.

**Negativas / trade-offs:**

- Mais arquivos por entidade (4-5 vs 1 do legado). Aceitável dado
  o ganho de testabilidade e isolamento.
- Adapter Redis "wrapper" duplica escrita (uma vez no legado em
  `@/lib/<entity>`, outra no `Redis<Entity>Repository`) durante
  a fase de transição. Removida na consolidação.
- DualWrite tem overhead (2 escritas por operação). Justificável
  apenas durante migração — removido na consolidação.

## Alternativas consideradas

- **Singleton repo via DI container:** Inversify, tsyringe. Boa
  ideia em apps grandes mas overkill aqui. Composer-as-function
  é mais explícito.
- **Wrapper único polimórfico:** um `WalletRepo` com config
  interna pra escolher driver. Acopla decisão à entidade — pior
  pra testes (não dá pra usar InMemory sem mexer no config).
- **Drizzle + Redis na mesma classe:** dupla persistência inline.
  Mata a abstração — teria que mockar tudo nos testes.

## Referências

- `src/modules/users/composer.ts` — exemplo simples (Redis vs Postgres).
- `src/modules/wallet/composer.ts` — exemplo com dual-write.
- `src/lib/walletWiring.ts` — helper de centralização para writes.
- `docs/m4-rollout-checklist.md`, `docs/m5-rollout-checklist.md` —
  procedimentos operacionais.
