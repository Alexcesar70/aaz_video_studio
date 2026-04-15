import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  selectWorkspaceRepo,
  RedisWorkspaceRepository,
} from '@/modules/workspaces'

describe('selectWorkspaceRepo', () => {
  const original: Record<string, string | undefined> = {}

  beforeEach(() => {
    original.FF_USE_POSTGRES_WORKSPACES = process.env.FF_USE_POSTGRES_WORKSPACES
    delete process.env.FF_USE_POSTGRES_WORKSPACES
  })

  afterEach(() => {
    if (original.FF_USE_POSTGRES_WORKSPACES !== undefined) {
      process.env.FF_USE_POSTGRES_WORKSPACES = original.FF_USE_POSTGRES_WORKSPACES
    } else {
      delete process.env.FF_USE_POSTGRES_WORKSPACES
    }
  })

  it('default OFF retorna RedisWorkspaceRepository', () => {
    expect(selectWorkspaceRepo()).toBeInstanceOf(RedisWorkspaceRepository)
  })

  it('flag ON retorna PostgresWorkspaceRepository', () => {
    process.env.FF_USE_POSTGRES_WORKSPACES = 'on'
    expect(selectWorkspaceRepo().constructor.name).toBe(
      'PostgresWorkspaceRepository',
    )
  })

  it('kill-switch OFF vence sobre user-targeted', () => {
    process.env.FF_USE_POSTGRES_WORKSPACES = 'off'
    process.env.FF_USE_POSTGRES_WORKSPACES_USERS = 'alex'
    expect(selectWorkspaceRepo({ userId: 'alex' })).toBeInstanceOf(
      RedisWorkspaceRepository,
    )
    delete process.env.FF_USE_POSTGRES_WORKSPACES_USERS
  })
})
