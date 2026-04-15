import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  selectEpisodeRepo,
  RedisEpisodeRepository,
} from '@/modules/episodes'

describe('selectEpisodeRepo', () => {
  const original: Record<string, string | undefined> = {}

  beforeEach(() => {
    original.FF_USE_POSTGRES_EPISODES = process.env.FF_USE_POSTGRES_EPISODES
    delete process.env.FF_USE_POSTGRES_EPISODES
  })

  afterEach(() => {
    if (original.FF_USE_POSTGRES_EPISODES !== undefined) {
      process.env.FF_USE_POSTGRES_EPISODES = original.FF_USE_POSTGRES_EPISODES
    } else {
      delete process.env.FF_USE_POSTGRES_EPISODES
    }
  })

  it('default OFF retorna RedisEpisodeRepository', () => {
    expect(selectEpisodeRepo()).toBeInstanceOf(RedisEpisodeRepository)
  })

  it('flag ON retorna PostgresEpisodeRepository', () => {
    process.env.FF_USE_POSTGRES_EPISODES = 'on'
    expect(selectEpisodeRepo().constructor.name).toBe(
      'PostgresEpisodeRepository',
    )
  })
})
