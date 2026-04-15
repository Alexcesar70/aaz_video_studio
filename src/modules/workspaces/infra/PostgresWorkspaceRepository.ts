import { eq, desc, and, type SQL } from 'drizzle-orm'
import type { Workspace } from '../domain/Workspace'
import type {
  WorkspaceRepository,
  WorkspaceListFilter,
} from '../ports/WorkspaceRepository'
import { getDb, type Db } from '@/db/client'
import { workspaces, type WorkspaceRow, type WorkspaceInsert } from '@/db/schema'

/**
 * Repository Postgres para Workspace (via Drizzle).
 *
 * Mantém a API do port idêntica ao InMemory — troca de adapter é
 * uma linha no composer.
 */
export class PostgresWorkspaceRepository implements WorkspaceRepository {
  private readonly _injectedDb?: Db

  constructor(db?: Db) {
    this._injectedDb = db
  }

  private get db(): Db {
    return this._injectedDb ?? getDb()
  }

  async findById(id: string): Promise<Workspace | null> {
    const rows = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1)
    return rows[0] ? rowToWorkspace(rows[0]) : null
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    const rows = await this.db
      .select()
      .from(workspaces)
      .where(eq(workspaces.slug, slug))
      .limit(1)
    return rows[0] ? rowToWorkspace(rows[0]) : null
  }

  async list(filter?: WorkspaceListFilter): Promise<Workspace[]> {
    const conds: SQL[] = []
    if (filter?.status) conds.push(eq(workspaces.status, filter.status))
    if (filter?.ownerId) conds.push(eq(workspaces.ownerId, filter.ownerId))

    const base = this.db.select().from(workspaces).orderBy(desc(workspaces.createdAt))
    const q = conds.length > 0 ? base.where(and(...conds)!) : base
    const limited = filter?.limit && filter.limit > 0 ? q.limit(filter.limit) : q

    const rows = await limited
    return rows.map(rowToWorkspace)
  }

  async upsert(ws: Workspace): Promise<Workspace> {
    const insert = workspaceToInsert(ws)
    const updateSet: Partial<WorkspaceInsert> = {
      name: insert.name,
      slug: insert.slug,
      plan: insert.plan,
      status: insert.status,
      ownerId: insert.ownerId,
      type: insert.type,
      maxUsers: insert.maxUsers,
      walletId: insert.walletId,
      products: insert.products,
      leaderCanCreate: insert.leaderCanCreate,
      billingEmail: insert.billingEmail,
      updatedAt: insert.updatedAt,
    }
    await this.db
      .insert(workspaces)
      .values(insert)
      .onConflictDoUpdate({ target: workspaces.id, set: updateSet })
    return ws
  }

  async remove(id: string): Promise<void> {
    await this.db.delete(workspaces).where(eq(workspaces.id, id))
  }
}

export function rowToWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    status: row.status as Workspace['status'],
    ownerId: row.ownerId,
    type: row.type as Workspace['type'],
    maxUsers: row.maxUsers,
    walletId: row.walletId ?? '',
    products: row.products,
    leaderCanCreate: row.leaderCanCreate,
    billingEmail: row.billingEmail ?? '',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function workspaceToInsert(ws: Workspace): WorkspaceInsert {
  return {
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    plan: ws.plan,
    status: ws.status,
    ownerId: ws.ownerId,
    type: ws.type,
    maxUsers: ws.maxUsers,
    walletId: ws.walletId || null,
    products: ws.products,
    leaderCanCreate: ws.leaderCanCreate,
    billingEmail: ws.billingEmail || null,
    createdAt: new Date(ws.createdAt),
    updatedAt: new Date(ws.updatedAt),
  }
}
