/**
 * Schema Postgres para Projects.
 *
 * Um Project é o container de Episodes. Pertence a um workspace.
 * `memberIds` é JSONB pra manter simples — se houver necessidade
 * futura de query por member, migra pra tabela `project_members`.
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'

export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    createdBy: text('created_by').notNull(),
    memberIds: jsonb('member_ids').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    wsIdx: index('projects_workspace_id_idx').on(t.workspaceId),
  }),
)

export type ProjectRow = typeof projects.$inferSelect
export type ProjectInsert = typeof projects.$inferInsert
