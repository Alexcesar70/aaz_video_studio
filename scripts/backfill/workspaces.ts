/**
 * Backfill Redis → Postgres para Workspaces (Organizations).
 *
 * Lê chaves `aaz:org:*` e faz upsert em `workspaces` table via
 * Postgres adapter. Idempotente (ON CONFLICT DO UPDATE).
 *
 * Como rodar (com DATABASE_URL e REDIS_URL setados):
 *   npx tsx scripts/backfill/workspaces.ts
 */

import { getRedis } from '@/lib/redis'
import { PostgresWorkspaceRepository, type Workspace } from '@/modules/workspaces'

interface BackfillResult {
  read: number
  written: number
  skipped: number
  errors: Array<{ id: string; error: string }>
}

async function run(): Promise<BackfillResult> {
  const redis = await getRedis()
  const repo = new PostgresWorkspaceRepository()

  const keys = await redis.keys('aaz:org:*')
  // Filtra índices secundários (aaz:org_slug:*)
  const orgKeys = keys.filter((k) => !k.startsWith('aaz:org_slug:'))

  const result: BackfillResult = { read: 0, written: 0, skipped: 0, errors: [] }

  for (const key of orgKeys) {
    result.read++
    try {
      const raw = await redis.get(key)
      if (!raw) {
        result.skipped++
        continue
      }
      const ws = JSON.parse(raw) as Workspace
      await repo.upsert(ws)
      result.written++
    } catch (err) {
      result.errors.push({
        id: key,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return result
}

run()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2))
    process.exit(r.errors.length > 0 ? 1 : 0)
  })
  .catch((err) => {
    console.error('Backfill failed:', err)
    process.exit(2)
  })
