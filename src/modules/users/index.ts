/**
 * Public API do módulo `users`.
 *
 * Este módulo substitui `@/lib/users.ts` progressivamente. A
 * migração Redis → Postgres acontece via seleção de adapter:
 *
 *   import {
 *     PostgresUserRepository,
 *     InMemoryUserRepository,
 *     getUserById,
 *   } from '@/modules/users'
 *
 *   const repo = process.env.USE_POSTGRES_USERS === 'on'
 *     ? new PostgresUserRepository()
 *     : new RedisUserRepositoryLegacy() // wrapping @/lib/users
 *
 * O adapter legado Redis é criado no PR de wiring (dual-read),
 * não aqui — este módulo é sobre o modelo novo.
 */

// Domain
export type {
  User,
  PublicUser,
  UserRole,
  UserStatus,
} from './domain/User'
export {
  validateUser,
  toPublicUser,
  USER_ROLES,
  USER_STATUSES,
  InvalidUserError,
} from './domain/User'

// Ports
export type {
  UserRepository,
  UserListFilter,
} from './ports/UserRepository'

// Infra
export { InMemoryUserRepository } from './infra/InMemoryUserRepository'
export {
  PostgresUserRepository,
  rowToUser,
  userToInsert,
} from './infra/PostgresUserRepository'
export { RedisUserRepository } from './infra/RedisUserRepository'

// Composer (M4-PR1) — escolhe Redis ou Postgres por flag
export { selectUserRepo } from './composer'

// Use cases
export {
  getUserById,
  getUserByEmail,
  getPublicUserById,
  getUserByIdOrThrow,
  UserNotFoundError,
} from './usecases/getUser'
export { listUsers } from './usecases/listUsers'
export { upsertUser } from './usecases/upsertUser'
export type { UpsertUserInput } from './usecases/upsertUser'
