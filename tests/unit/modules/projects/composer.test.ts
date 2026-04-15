import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  selectProjectRepo,
  RedisProjectRepository,
} from '@/modules/projects'

describe('selectProjectRepo', () => {
  const original: Record<string, string | undefined> = {}

  beforeEach(() => {
    original.FF_USE_POSTGRES_PROJECTS = process.env.FF_USE_POSTGRES_PROJECTS
    delete process.env.FF_USE_POSTGRES_PROJECTS
  })

  afterEach(() => {
    if (original.FF_USE_POSTGRES_PROJECTS !== undefined) {
      process.env.FF_USE_POSTGRES_PROJECTS = original.FF_USE_POSTGRES_PROJECTS
    } else {
      delete process.env.FF_USE_POSTGRES_PROJECTS
    }
  })

  it('default OFF retorna RedisProjectRepository', () => {
    expect(selectProjectRepo()).toBeInstanceOf(RedisProjectRepository)
  })

  it('flag ON retorna PostgresProjectRepository', () => {
    process.env.FF_USE_POSTGRES_PROJECTS = 'on'
    expect(selectProjectRepo().constructor.name).toBe(
      'PostgresProjectRepository',
    )
  })
})
