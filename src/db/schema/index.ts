/**
 * Barrel export de todos os schemas Drizzle.
 *
 * Drizzle precisa que TODOS os schemas sejam conhecidos no momento
 * de gerar migrações — por isso este arquivo é o "schema root"
 * referenciado em drizzle.config.ts.
 */

export * from './workspaces'
export * from './users'
export * from './wallets'
export * from './projects'
export * from './episodes'
