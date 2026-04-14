/**
 * Schema Postgres para Episodes.
 *
 * Um Episode é um container de Scenes. Pode ser "avulso" (sem project,
 * projectId=null) ou pertencer a um Project. Review workflow tem
 * campos próprios (finalStatus, reviewNote, etc.) — modelo espelha o
 * shape atual no Redis para migração 1:1.
 *
 * Scenes permanecem no Redis nesta fase — elas são o objeto mais
 * volumoso (videoUrl etc.) e a migração delas requer estratégia
 * separada (candidatas a ficar em Postgres OU em tabela de object
 * storage metadata).
 */

import {
  pgTable,
  text,
  timestamp,
  numeric,
  index,
} from 'drizzle-orm/pg-core'
import { projects } from './projects'
import { workspaces } from './workspaces'

export const episodes = pgTable(
  'episodes',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: text('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    createdBy: text('created_by').notNull(),
    finalVideoUrl: text('final_video_url'),
    finalVideoSizeMb: numeric('final_video_size_mb', { precision: 10, scale: 2 }),
    finalVideoUploadedAt: timestamp('final_video_uploaded_at', { withTimezone: true }),
    finalVideoUploadedBy: text('final_video_uploaded_by'),
    finalStatus: text('final_status').notNull().default('none'), // 'none' | 'pending_review' | 'approved' | 'needs_changes'
    reviewNote: text('review_note'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: text('reviewed_by'),
    creatorNote: text('creator_note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    wsIdx: index('episodes_workspace_id_idx').on(t.workspaceId),
    projIdx: index('episodes_project_id_idx').on(t.projectId),
  }),
)

export type EpisodeRow = typeof episodes.$inferSelect
export type EpisodeInsert = typeof episodes.$inferInsert
