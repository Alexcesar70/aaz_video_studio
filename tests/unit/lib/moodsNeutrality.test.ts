import { describe, it, expect } from 'vitest'
import { MOODS, getMood } from '@/lib/moods'

/**
 * PR #6 — Moods decouple
 * Validação: as `narratives` ficaram universe-neutral (sem referências
 * específicas ao universo AAZ com Jesus). As injections visuais
 * (imagePromptInjection / videoPromptInjection) NÃO foram alteradas
 * — output técnico de geração permanece íntegro.
 */

const AAZ_SPECIFIC_TERMS = [
  'Clube da Aliança',
  'Clube',
  'Theos',
  'bíblic',
  'biblic',
]

describe('Moods neutrality (PR #6 decouple)', () => {
  it('nenhuma narrative contém termos AAZ-específicos', () => {
    for (const mood of MOODS) {
      for (const term of AAZ_SPECIFIC_TERMS) {
        expect(
          mood.narrative.toLowerCase(),
          `mood "${mood.id}" ainda menciona "${term}" na narrative`,
        ).not.toContain(term.toLowerCase())
      }
    }
  })

  it('nenhuma imagePromptInjection contém termos AAZ-específicos', () => {
    for (const mood of MOODS) {
      for (const term of AAZ_SPECIFIC_TERMS) {
        expect(
          mood.imagePromptInjection.toLowerCase(),
        ).not.toContain(term.toLowerCase())
      }
    }
  })

  it('nenhuma videoPromptInjection contém termos AAZ-específicos', () => {
    for (const mood of MOODS) {
      for (const term of AAZ_SPECIFIC_TERMS) {
        expect(
          mood.videoPromptInjection.toLowerCase(),
        ).not.toContain(term.toLowerCase())
      }
    }
  })

  it('todos os moods (exceto "free") continuam com injection visual não-vazia', () => {
    for (const mood of MOODS) {
      if (mood.id === 'free') continue
      expect(mood.imagePromptInjection.length).toBeGreaterThan(20)
      expect(mood.videoPromptInjection.length).toBeGreaterThan(20)
    }
  })

  it('ids canônicos preservados (não quebra contratos existentes)', () => {
    const ids = MOODS.map((m) => m.id).sort()
    expect(ids).toEqual([
      'adventure',
      'dramatic',
      'epic',
      'ethereal',
      'free',
      'intimate_night',
      'warm',
    ])
  })

  it('getMood("warm") retorna narrative universal', () => {
    const warm = getMood('warm')
    expect(warm.narrative).toContain('cotidianos')
  })

  it('getMood("epic") troca "bíblicas" por "grandiosas"', () => {
    const epic = getMood('epic')
    expect(epic.narrative).toContain('grandiosas')
  })
})
