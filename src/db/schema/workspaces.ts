/**
 * Schema Postgres para Workspaces (ex-Organizations).
 *
 * Ver ADR-0004 (rename Organization→Workspace) e ADR-0006 (Postgres
 * + Drizzle — este milestone).
 *
 * Regras de integridade:
 *   - `slug` é único globalmente, mas distinto do `id` por histórico
 *     de colisões (legado).
 *   - `wallet_id` é opcional até a wallet ser criada (circular ref
 *     resolvido no fluxo de signup). FK adicionada depois via ALTER.
 */

import { pgTable, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const workspaces = pgTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: text('plan').notNull().default('free'),
  status: text('status').notNull().default('active'), // 'active' | 'suspended' | 'cancelled'
  ownerId: text('owner_id').notNull(),
  type: text('type').notNull().default('individual'), // 'individual' | 'team'
  maxUsers: integer('max_users').notNull().default(1),
  walletId: text('wallet_id'),
  products: jsonb('products').$type<string[]>().notNull().default([]),
  leaderCanCreate: boolean('leader_can_create').notNull().default(true),
  billingEmail: text('billing_email'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type WorkspaceRow = typeof workspaces.$inferSelect
export type WorkspaceInsert = typeof workspaces.$inferInsert
