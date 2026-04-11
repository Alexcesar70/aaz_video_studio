/**
 * Constantes compartilhadas do AAZ Studio
 */

export const C = {
  bg: '#13131a', surface: '#1a1a24', card: '#22222e', border: '#2e2e3e',
  borderHi: '#3a3a4e',
  gold: '#C9A84C', goldLight: '#E8C96A', goldDim: '#6A5828', goldGlow: '#C9A84C30',
  blue: '#5B8DEF', blueGlow: '#5B8DEF20',
  green: '#4ADE80', greenGlow: '#4ADE8020',
  red: '#F87171', redGlow: '#F8717120',
  purple: '#A78BFA', purpleGlow: '#A78BFA20',
  text: '#E8E8F0', textDim: '#9898B0',
} as const

/* Personagens base do universo AAZ com Jesus */
export const CHARACTERS = [
  { id: 'abraao', name: 'Abraão', emoji: '👴', color: '#C9A84C' },
  { id: 'abigail', name: 'Abigail', emoji: '👧', color: '#D4A0C8' },
  { id: 'zaqueu', name: 'Zaqueu', emoji: '🧔', color: '#7AB8D4' },
  { id: 'tuba', name: 'Tuba', emoji: '🐕', color: '#C8A07A' },
  { id: 'theos', name: 'Theos', emoji: '✨', color: '#A8D4FF' },
  { id: 'miriam', name: 'Miriã', emoji: '👩', color: '#D4C0A0' },
  { id: 'elias', name: 'Elias', emoji: '🧙', color: '#A0D4B0' },
]

export const RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9']
export const DURATIONS = [4, 5, 8, 10, 12, 15]
export const COST_PER_SEC = parseFloat(process.env.NEXT_PUBLIC_COST_PER_SEC || '0.19')

export const EMOTIONS = [
  { id: 'tensao', label: 'Tensão' },
  { id: 'surpresa', label: 'Surpresa' },
  { id: 'alegria', label: 'Alegria' },
  { id: 'culpa', label: 'Culpa' },
  { id: 'curiosidade', label: 'Curiosidade' },
  { id: 'reflexao', label: 'Reflexão' },
  { id: 'conflito', label: 'Conflito' },
  { id: 'resolucao', label: 'Resolução' },
  { id: 'outro', label: 'Outro' },
]

export const CAMERA_FIXED_OPTIONS = [
  'Close-up', 'Medium close-up', 'Medium shot', 'Wide', 'Extreme wide',
  "OTS — Abraão", "OTS — Abigail", "OTS — Zaqueu",
  "Bird's-eye", 'Low-angle', 'Dutch angle',
]
