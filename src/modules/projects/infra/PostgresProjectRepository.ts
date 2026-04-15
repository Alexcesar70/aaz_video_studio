import { eq, desc, and, sql, type SQL } from 'drizzle-orm'
import type { Project } from '../domain/Project'
import { validateProject } from '../domain/Project'
import type {
  ProjectRepository,
  ProjectListFilter,
} from '../ports/ProjectRepository'
import { getDb, type Db } from '@/db/client'
import { projects, type ProjectRow, type ProjectInsert } from '@/db/schema'

export class PostgresProjectRepository implements ProjectRepository {
  private readonly db: Db

  constructor(db?: Db) {
    this.db = db ?? getDb()
  }

  async findById(id: string): Promise<Project | null> {
    const rows = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1)
    return rows[0] ? rowToProject(rows[0]) : null
  }

  async list(filter?: ProjectListFilter): Promise<Project[]> {
    const conds: SQL[] = []
    if (filter?.workspaceId) {
      conds.push(eq(projects.workspaceId, filter.workspaceId))
    }
    if (filter?.createdBy) {
      conds.push(eq(projects.createdBy, filter.createdBy))
    }
    if (filter?.memberId) {
      // Query JSONB contains: member_ids @> '["<userId>"]'
      conds.push(sql`${projects.memberIds} @> ${JSON.stringify([filter.memberId])}::jsonb`)
    }

    const base = this.db.select().from(projects).orderBy(desc(projects.createdAt))
    const q = conds.length > 0 ? base.where(and(...conds)!) : base
    const limited = filter?.limit && filter.limit > 0 ? q.limit(filter.limit) : q

    const rows = await limited
    return rows.map(rowToProject)
  }

  async upsert(project: Project): Promise<Project> {
    const validated = validateProject(project)
    const insert = projectToInsert(validated)
    const updateSet: Partial<ProjectInsert> = {
      name: insert.name,
      workspaceId: insert.workspaceId,
      createdBy: insert.createdBy,
      memberIds: insert.memberIds,
      updatedAt: insert.updatedAt,
    }
    await this.db
      .insert(projects)
      .values(insert)
      .onConflictDoUpdate({ target: projects.id, set: updateSet })
    return validated
  }

  async remove(id: string): Promise<void> {
    await this.db.delete(projects).where(eq(projects.id, id))
  }
}

export function rowToProject(row: ProjectRow): Project {
  return validateProject({
    id: row.id,
    name: row.name,
    workspaceId: row.workspaceId,
    createdBy: row.createdBy,
    memberIds: row.memberIds,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })
}

export function projectToInsert(project: Project): ProjectInsert {
  return {
    id: project.id,
    name: project.name,
    workspaceId: project.workspaceId,
    createdBy: project.createdBy,
    memberIds: project.memberIds,
    createdAt: new Date(project.createdAt),
    updatedAt: new Date(project.updatedAt),
  }
}
