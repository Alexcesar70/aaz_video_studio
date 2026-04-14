/**
 * Cliente Drizzle + postgres-js, singleton.
 *
 * Uso:
 *   import { getDb } from '@/db/client'
 *   const db = getDb()
 *   const rows = await db.select().from(users).where(eq(users.id, 'x'))
 *
 * Produção (Vercel): `DATABASE_URL` aponta para um Postgres gerenciado
 * (Supabase, Neon, Vercel Postgres). A conexão é reutilizada entre
 * invocações serverless via `globalThis` cache.
 *
 * Dev local: exporte `DATABASE_URL=postgres://localhost:5432/aaz_dev`
 * ou similar. Os módulos concretos (M3-PR2+) ainda podem usar
 * `InMemoryXxxRepository` quando `DATABASE_URL` não estiver setado.
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export type Db = ReturnType<typeof drizzle<typeof schema>>

interface DbCache {
  client?: ReturnType<typeof postgres>
  db?: Db
}

const globalForDb = globalThis as unknown as { __aaz_db__?: DbCache }

function cache(): DbCache {
  if (!globalForDb.__aaz_db__) globalForDb.__aaz_db__ = {}
  return globalForDb.__aaz_db__
}

export function getDb(): Db {
  const c = cache()
  if (c.db) return c.db

  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL não configurada')
  }

  // `prepare: false` é recomendado pra uso em serverless sem pool
  // compartilhado (cada edge worker pode ter seu próprio prepared
  // statement cache, que fica stale). `max: 1` com pool gerenciado
  // do provedor (Neon/Supabase) é ideal.
  c.client = postgres(url, { prepare: false, max: 1 })
  c.db = drizzle(c.client, { schema })
  return c.db
}

/**
 * Fecha a conexão. Útil em scripts one-off (seeds, migrations
 * manuais) — não usar em request handlers.
 */
export async function closeDb(): Promise<void> {
  const c = cache()
  if (c.client) {
    await c.client.end({ timeout: 5 })
    c.client = undefined
    c.db = undefined
  }
}
