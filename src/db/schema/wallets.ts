/**
 * Schema Postgres para Wallets e Wallet Transactions.
 *
 * Por que Postgres > Redis aqui: wallet é o ÚNICO subsistema
 * verdadeiramente financeiro do produto. Postgres dá:
 *   - Transações ACID (spend + registrar transação em um só commit).
 *   - Constraint CHECK garantindo balance >= 0.
 *   - Decimal nativo (sem arredondamento de float).
 *   - Foreign keys dando integridade referencial (txn → wallet).
 *
 * Regras:
 *   - `balanceUsd`, `totalTopUps`, `totalSpent` usam NUMERIC(14,4) —
 *     4 casas decimais permitem tracking de décimos de centavo sem
 *     drift (custos do Segmind vêm em valores bem pequenos).
 *   - `version` é optimistic lock: WHERE version = :old ao atualizar.
 *     Se zero linhas afetadas, caller sabe que houve concorrência.
 *   - Transações são append-only (sem UPDATE/DELETE pós-insert).
 */

import {
  pgTable,
  text,
  integer,
  timestamp,
  numeric,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const wallets = pgTable(
  'wallets',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    ownerType: text('owner_type').notNull(), // 'organization' | 'user'
    balanceUsd: numeric('balance_usd', { precision: 14, scale: 4 })
      .notNull()
      .default('0'),
    totalTopUps: numeric('total_top_ups', { precision: 14, scale: 4 })
      .notNull()
      .default('0'),
    totalSpent: numeric('total_spent', { precision: 14, scale: 4 })
      .notNull()
      .default('0'),
    warningThreshold: integer('warning_threshold').notNull().default(20),
    criticalThreshold: integer('critical_threshold').notNull().default(10),
    dangerThreshold: integer('danger_threshold').notNull().default(5),
    version: integer('version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ownerIdx: index('wallets_owner_idx').on(t.ownerType, t.ownerId),
    balanceNonNegative: check(
      'wallets_balance_non_negative',
      sql`${t.balanceUsd} >= 0`,
    ),
  }),
)

export type WalletRow = typeof wallets.$inferSelect
export type WalletInsert = typeof wallets.$inferInsert

export const walletTransactions = pgTable(
  'wallet_transactions',
  {
    id: text('id').primaryKey(),
    walletId: text('wallet_id')
      .notNull()
      .references(() => wallets.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // top_up | spend | transfer_in | transfer_out | refund | adjustment | monthly_credit
    amountUsd: numeric('amount_usd', { precision: 14, scale: 4 }).notNull(),
    reason: text('reason').notNull().default(''),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    walletIdx: index('wallet_transactions_wallet_id_idx').on(t.walletId),
    createdIdx: index('wallet_transactions_created_at_idx').on(t.createdAt),
  }),
)

export type WalletTransactionRow = typeof walletTransactions.$inferSelect
export type WalletTransactionInsert = typeof walletTransactions.$inferInsert
