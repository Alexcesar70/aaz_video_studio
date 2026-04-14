import type { Asset } from '@/lib/assets'

/**
 * 7 personagens Lead do projeto AAZ com Jesus.
 *
 * Este arquivo é a ÚNICA fonte da verdade dos leads durante o M1. Ele é
 * consumido por:
 *   1. `src/lib/assets.ts` (re-export `LEAD_CHARACTERS`) — retrocompat.
 *   2. `seedAazLeadCharacters` use case — popula o DB idempotentemente.
 *
 * Estes personagens são específicos do universo AAZ com Jesus.
 * Novos workspaces (outros universos narrativos) NÃO devem vê-los —
 * por isso são seedados com `organizationId='aaz-com-jesus'`.
 *
 * Quando PR #9 consolidar, este arquivo é removido: os registros no DB
 * viram fonte da verdade única.
 */
export const AAZ_LEAD_CHARACTERS: Asset[] = [
  {
    id: 'abraao',
    type: 'character',
    name: 'Abraão',
    emoji: '👴',
    description:
      '8 year old boy, messy orange-red hair, fair skin with freckles, hazel-green eyes, slightly protruding ears, pink vest over teal t-shirt, gray cargo shorts, green-mint canvas sneakers. Slightly leaning forward, always about to act.',
    imageUrls: [],
    isOfficial: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    tags: ['lead', 'clube', 'crianca', 'menino'],
  },
  {
    id: 'abigail',
    type: 'character',
    name: 'Abigail',
    emoji: '👧',
    description:
      '7 year old girl, dark curly hair in two side puffs, warm brown skin, big brown eyes with defined lashes, rosy cheeks, multi-layered dress with colorful geometric print, colorful neck scarf, beaded bracelets, burgundy-pink flats.',
    imageUrls: [],
    isOfficial: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    tags: ['lead', 'clube', 'crianca', 'menina'],
  },
  {
    id: 'zaqueu',
    type: 'character',
    name: 'Zaqueu',
    emoji: '🧔',
    description:
      '9 year old boy, mini-dreads with clay texture, deep uniform dark skin, expressive brown eyes, wide smile, open olive-green jacket with gold buttons over orange t-shirt with colorful print, geometric shorts (blue/green/orange/pink), colorful canvas sneakers with orange laces.',
    imageUrls: [],
    isOfficial: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    tags: ['lead', 'clube', 'crianca', 'menino'],
  },
  {
    id: 'tuba',
    type: 'character',
    name: 'Tuba',
    emoji: '🐕',
    description:
      'medium dog, intense amber-orange fur with clay fiber texture, cream chest and belly, rounded black nose, expressive dark-brown eyes with independently articulated clay eyebrows, mobile floppy ears, tail curled upward. Eyebrows are his main emotional instrument.',
    imageUrls: [],
    isOfficial: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    tags: ['lead', 'clube', 'animal', 'cachorro'],
  },
  {
    id: 'theos',
    type: 'character',
    name: 'Theos',
    emoji: '✨',
    description:
      'NEVER appears on screen as a humanoid. Acts only through subtle physical environmental signs: sudden wind, object falling at the right moment, light shifting, door opening by itself.',
    imageUrls: [],
    isOfficial: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    tags: ['lead', 'ambiental'],
  },
  {
    id: 'miriam',
    type: 'character',
    name: 'Miriã',
    emoji: '👩',
    description:
      'adult woman, mother, curly hair, often wears apron, welcoming warm eyes. Guides through questions, never statements. Crouches to children\'s level when the question matters.',
    imageUrls: [],
    isOfficial: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    tags: ['lead', 'familia', 'adulto', 'mulher'],
  },
  {
    id: 'elias',
    type: 'character',
    name: 'Elias',
    emoji: '🧙',
    description:
      'adult man, father, short beard, large hands, physically calm presence. Speaks little but with impact. One sentence, declarative, stops.',
    imageUrls: [],
    isOfficial: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    tags: ['lead', 'familia', 'adulto', 'homem'],
  },
]

/** Workspace/org default para seed dos leads AAZ. */
export const AAZ_DEFAULT_ORG_ID = 'aaz-com-jesus'
