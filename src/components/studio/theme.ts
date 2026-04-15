/**
 * Paleta de cores compartilhada pelo Studio.
 *
 * Extraída de AAZStudio.tsx (M2-PR7) para permitir reuso em componentes
 * extraídos (atoms, modals, widgets) sem duplicar hex codes.
 *
 * Pattern:
 *   import { C } from '@/components/studio/theme'
 *   <div style={{ background: C.card, color: C.text }}>
 */
export const C = {
  bg: '#13131a',
  surface: '#1a1a24',
  card: '#22222e',
  border: '#2e2e3e',
  borderHi: '#3a3a4e',
  gold: '#C9A84C',
  goldLight: '#E8C96A',
  goldDim: '#6A5828',
  goldGlow: '#C9A84C30',
  blue: '#5B8DEF',
  blueGlow: '#5B8DEF20',
  green: '#4ADE80',
  greenGlow: '#4ADE8020',
  red: '#F87171',
  purple: '#A78BFA',
  purpleGlow: '#A78BFA20',
  text: '#E8E8F0',
  textDim: '#9898B0',
} as const

export type StudioPalette = typeof C
