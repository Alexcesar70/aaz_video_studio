/**
 * Schema Postgres para Users.
 *
 * Regras:
 *   - `id` é text (slug) para preservar URLs e referências atuais.
 *   - `organizationId` é nullable — suporta user órfão pré-wizard (M1-PR7).
 *   - `passwordHash` é obrigatório. NUNCA é serializado em APIs públicas
 *     (responsabilidade do use case de leitura).
 *   - `permissions` e `products` são JSONB para flexibilidade (evita
 *     criar tabelas auxiliares até que haja requisito real).
 */

import {
  pgTable,
  text,
  timestamp,
  jsonb,
  numeric,
  index,
} from 'drizzle-orm/pg-core'
import { workspaces } from './workspaces'

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    role: text('role').notNull(), // 'super_admin' | 'admin' | 'creator'
    status: text('status').notNull().default('active'), // 'active' | 'revoked'
    passwordHash: text('password_hash').notNull(),
    monthlyBudgetUsd: numeric('monthly_budget_usd', { precision: 14, scale: 4 }),
    assignedProjectIds: jsonb('assigned_project_ids')
      .$type<string[]>()
      .notNull()
      .default([]),
    organizationId: text('organization_id').references(() => workspaces.id, {
      onDelete: 'set null',
    }),
    permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
    products: jsonb('products').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    createdBy: text('created_by').notNull().default('system'),
  },
  (t) => ({
    orgIdx: index('users_organization_id_idx').on(t.organizationId),
    roleIdx: index('users_role_idx').on(t.role),
  }),
)

export type UserRow = typeof users.$inferSelect
export type UserInsert = typeof users.$inferInsert
