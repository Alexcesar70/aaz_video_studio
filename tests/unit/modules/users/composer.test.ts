import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { selectUserRepo } from '@/modules/users'
import { RedisUserRepository } from '@/modules/users'

describe('selectUserRepo', () => {
  const originalEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    // Snapshot relevant env vars
    originalEnv.FF_USE_POSTGRES_USERS = process.env.FF_USE_POSTGRES_USERS
    originalEnv.FF_USE_POSTGRES_USERS_USERS =
      process.env.FF_USE_POSTGRES_USERS_USERS
    delete process.env.FF_USE_POSTGRES_USERS
    delete process.env.FF_USE_POSTGRES_USERS_USERS
  })

  afterEach(() => {
    if (originalEnv.FF_USE_POSTGRES_USERS !== undefined) {
      process.env.FF_USE_POSTGRES_USERS = originalEnv.FF_USE_POSTGRES_USERS
    } else {
      delete process.env.FF_USE_POSTGRES_USERS
    }
    if (originalEnv.FF_USE_POSTGRES_USERS_USERS !== undefined) {
      process.env.FF_USE_POSTGRES_USERS_USERS =
        originalEnv.FF_USE_POSTGRES_USERS_USERS
    } else {
      delete process.env.FF_USE_POSTGRES_USERS_USERS
    }
  })

  it('default (flag OFF) retorna RedisUserRepository', () => {
    const repo = selectUserRepo()
    expect(repo).toBeInstanceOf(RedisUserRepository)
  })

  it('flag global ON retorna PostgresUserRepository', () => {
    process.env.FF_USE_POSTGRES_USERS = 'on'
    const repo = selectUserRepo()
    // Não importamos PostgresUserRepository para evitar instanciar getDb()
    // sem DATABASE_URL — checamos pelo NOME da classe.
    expect(repo.constructor.name).toBe('PostgresUserRepository')
  })

  it('flag user-targeted ON apenas para esse user', () => {
    process.env.FF_USE_POSTGRES_USERS_USERS = 'alexandre'
    const aliceRepo = selectUserRepo({ userId: 'alice' })
    const alexRepo = selectUserRepo({ userId: 'alexandre' })
    expect(aliceRepo).toBeInstanceOf(RedisUserRepository)
    expect(alexRepo.constructor.name).toBe('PostgresUserRepository')
  })

  it('kill-switch FF_USE_POSTGRES_USERS=off vence sobre user-targeted', () => {
    process.env.FF_USE_POSTGRES_USERS = 'off'
    process.env.FF_USE_POSTGRES_USERS_USERS = 'alexandre'
    const repo = selectUserRepo({ userId: 'alexandre' })
    expect(repo).toBeInstanceOf(RedisUserRepository)
  })
})
