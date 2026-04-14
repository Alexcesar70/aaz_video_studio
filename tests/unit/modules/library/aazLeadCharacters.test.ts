import { describe, it, expect } from 'vitest'
import {
  AAZ_LEAD_CHARACTERS,
  AAZ_DEFAULT_ORG_ID,
} from '@/modules/library'

describe('AAZ_LEAD_CHARACTERS seed data', () => {
  it('exporta exatamente os 7 personagens canônicos', () => {
    const ids = AAZ_LEAD_CHARACTERS.map((c) => c.id).sort()
    expect(ids).toEqual([
      'abigail',
      'abraao',
      'elias',
      'miriam',
      'theos',
      'tuba',
      'zaqueu',
    ])
  })

  it('todos são type=character e isOfficial=true', () => {
    for (const c of AAZ_LEAD_CHARACTERS) {
      expect(c.type).toBe('character')
      expect(c.isOfficial).toBe(true)
    }
  })

  it('todos têm description não-vazia', () => {
    for (const c of AAZ_LEAD_CHARACTERS) {
      expect(c.description.length).toBeGreaterThan(30)
    }
  })

  it('todos têm emoji', () => {
    for (const c of AAZ_LEAD_CHARACTERS) {
      expect(c.emoji).toBeTruthy()
    }
  })

  it('ids são slugs válidos (lowercase, sem espaços)', () => {
    for (const c of AAZ_LEAD_CHARACTERS) {
      expect(c.id).toMatch(/^[a-z0-9_]+$/)
    }
  })

  it('AAZ_DEFAULT_ORG_ID aponta pra aaz-com-jesus', () => {
    expect(AAZ_DEFAULT_ORG_ID).toBe('aaz-com-jesus')
  })
})
