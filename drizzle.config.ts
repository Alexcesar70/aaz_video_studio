/**
 * Config do drizzle-kit — usado pra gerar migrations:
 *   npm run db:generate   → cria SQL a partir das mudanças de schema
 *   npm run db:migrate    → aplica migrations pendentes no DATABASE_URL
 *   npm run db:studio     → abre o Drizzle Studio (UI web)
 *
 * `schema` aponta para o barrel de schemas — qualquer arquivo dentro
 * dele é detectado automaticamente.
 */

import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/aaz_dev',
  },
  // Gera migrations "strict" que exigem confirmação em mudanças
  // potencialmente destrutivas.
  strict: true,
  verbose: true,
})
