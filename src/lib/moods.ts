/**
 * Registro de moods/tons visuais — fonte única usada por:
 *  - Atelier (image director) → injeta no prompt de imagem
 *  - Estúdio (scene director) → injeta no bloco Style & Mood do prompt de vídeo
 *
 * Mood ≠ Emoção:
 *  - Emoção é o que os personagens sentem (body physics — jaw tightens, etc)
 *  - Mood é o ambiente visual da cena (iluminação, paleta, atmosfera)
 *  - Ambos coexistem numa cena. Ex: jantar em família com luz dourada acolhedora
 *    (mood: Cálido) + tensão silenciosa de um segredo guardado (emoção: culpa).
 */

export type MoodId =
  | 'warm'
  | 'dramatic'
  | 'ethereal'
  | 'intimate_night'
  | 'epic'
  | 'adventure'
  | 'free'

export interface Mood {
  id: MoodId
  /** Label com ícone, usado em dropdowns e chips */
  label: string
  /** Só o ícone */
  icon: string
  /** Label curto sem ícone */
  shortLabel: string
  /** Descrição pt-br de quando o criador usaria esse mood */
  narrative: string
  /** Guidance injetado no system prompt do Image Director (Atelier) */
  imagePromptInjection: string
  /** Guidance injetado no system prompt do Scene Director (vídeo) */
  videoPromptInjection: string
}

export const MOODS: Mood[] = [
  {
    id: 'warm',
    label: '☀ Cálido',
    icon: '☀',
    shortLabel: 'Cálido',
    narrative: 'Dia-a-dia, conversas no Clube da Aliança, acolhimento, família',
    imagePromptInjection:
      'golden hour warm light, soft diffused shadows, ochre/cream/olive palette, warm ambient occlusion, intimate and welcoming atmosphere',
    videoPromptInjection:
      'Golden late-afternoon warm light, soft diffused shadows, ochre/cream/olive palette, warm ambient occlusion, intimate and welcoming atmosphere',
  },
  {
    id: 'dramatic',
    label: '⚡ Dramático',
    icon: '⚡',
    shortLabel: 'Dramático',
    narrative: 'Conflito, quebra de regra, tensão antes da resolução',
    imagePromptInjection:
      'strong directional side lighting, pronounced shadows, cooler blue tones mixed with warm highlights (teal and orange contrast), tense atmosphere, clear rim light on subject',
    videoPromptInjection:
      'Strong directional side lighting, pronounced shadows, cooler blue tones mixed with warm highlights (teal and orange contrast), tense atmosphere, clear rim light on subjects',
  },
  {
    id: 'ethereal',
    label: '✨ Etéreo',
    icon: '✨',
    shortLabel: 'Etéreo',
    narrative: 'Presença sutil de Theos, sinais ambientais, revelação, descoberta espiritual',
    imagePromptInjection:
      'soft glowing ambient light, suspended dust particles catching sunrays, pale gold and pearl white highlights, ethereal rim light, hint of warm lens flare, contemplative atmosphere',
    videoPromptInjection:
      'Soft glowing ambient light, suspended dust particles catching sunrays, pale gold and pearl white highlights, ethereal rim light, hint of warm lens flare, contemplative atmosphere',
  },
  {
    id: 'intimate_night',
    label: '🌙 Noturno íntimo',
    icon: '🌙',
    shortLabel: 'Noturno',
    narrative: 'Fogueira, reflexão antes de dormir, confissão sincera, segredo compartilhado',
    imagePromptInjection:
      'night scene, small pools of warm firelight or candlelight against deep blue darkness, deep shadows, golden glow on faces, starlit sky visible, intimate quiet mood',
    videoPromptInjection:
      'Night scene, small pools of warm firelight or candlelight against deep blue darkness, deep shadows, golden glow on faces, starlit sky visible, intimate quiet mood',
  },
  {
    id: 'epic',
    label: '🏔 Épico',
    icon: '🏔',
    shortLabel: 'Épico',
    narrative: 'Cenas bíblicas grandiosas — êxodo, monte, templo, palácio, multidões',
    imagePromptInjection:
      'vast wide composition, dramatic high-contrast lighting from above, saturated earth tones (ochre/terracotta/deep blue), sense of scale and grandeur, volumetric god rays, cinematic depth',
    videoPromptInjection:
      'Vast wide composition, dramatic high-contrast lighting from above, saturated earth tones (ochre/terracotta/deep blue), sense of scale and grandeur, volumetric god rays, cinematic depth',
  },
  {
    id: 'adventure',
    label: '🎒 Aventura',
    icon: '🎒',
    shortLabel: 'Aventura',
    narrative: 'Jornada, exploração, descobrimento, ação enérgica, alegria em movimento',
    imagePromptInjection:
      'bright daylight, clear defined shadows, vivid saturated colors, dynamic composition feel, sense of motion and discovery, crisp visibility, joyful energetic atmosphere',
    videoPromptInjection:
      'Bright daylight, clear defined shadows, vivid saturated colors, dynamic composition feel, sense of motion and discovery, crisp visibility, joyful energetic atmosphere',
  },
  {
    id: 'free',
    label: '— Livre',
    icon: '—',
    shortLabel: 'Livre',
    narrative: 'Controle total — o Claude segue só a descrição do criador, sem mood override',
    imagePromptInjection: '',
    videoPromptInjection: '',
  },
]

export const DEFAULT_MOOD_ID: MoodId = 'warm'

export function getMood(id: string | undefined | null): Mood {
  if (!id) return MOODS[0]
  return MOODS.find(m => m.id === id) ?? MOODS[0]
}

/**
 * Returns true if the mood has any visual guidance (i.e. isn't "free").
 */
export function hasMoodGuidance(id: string | undefined | null): boolean {
  const m = getMood(id)
  return !!m.videoPromptInjection || !!m.imagePromptInjection
}
