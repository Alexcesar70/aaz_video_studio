/**
 * Modelo unificado de Assets — personagens, cenários e itens.
 *
 * Os 7 personagens "Lead" do projeto AAZ com Jesus continuam definidos
 * como constante neste arquivo (fonte da verdade). Eles sempre aparecem
 * com isOfficial=true, não podem ser deletados, e são mesclados no topo
 * de qualquer listagem de assets retornada pelas API routes.
 *
 * Personagens custom, cenários e itens criados pelo usuário ficam no
 * Redis em aaz:asset:{type}:{id}. Rascunhos (variações não escolhidas)
 * ficam em aaz:draft:{type}:{id} com TTL de 30 dias.
 */

export type AssetType = 'character' | 'scenario' | 'item'

export interface Asset {
  /** Slug único — aparece nos prompts como @id */
  id: string
  type: AssetType
  /** Nome humano ("Faraó", "Nilo ao entardecer") */
  name: string
  /** Descrição canônica — entra no bloco Static Description dos prompts */
  description: string
  /** 1+ imagens de referência no Vercel Blob */
  imageUrls: string[]
  /** Prompt técnico usado pra gerar (null se foi upload manual) */
  prompt?: string
  /** Motor de imagem usado (ex: "nano-banana-pro") */
  engineId?: string
  /** Imagem de referência anexada durante a geração, se houver */
  sourceRefUrl?: string
  /** true só pros 7 leads — não podem ser deletados */
  isOfficial: boolean
  /** true enquanto é um rascunho (variação não escolhida) */
  isDraft?: boolean
  /** Emoji opcional pra UI (padrão por tipo se ausente) */
  emoji?: string
  /** Tags pra busca/filtro */
  tags?: string[]
  createdAt: string
  updatedAt: string
}

/** Prefixos Redis */
export const ASSET_PREFIX = 'aaz:asset:'
export const DRAFT_PREFIX = 'aaz:draft:'
export const DRAFT_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 dias

/**
 * Gera slug válido a partir de um nome humano.
 * "Faraó do Egito" → "farao_do_egito"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'asset'
}

/**
 * Personagens Lead do AAZ com Jesus — 7 IDs canônicos.
 * Esses viram Assets com isOfficial=true e não podem ser deletados.
 * Descrições aqui alimentam o bloco Static Description dos prompts.
 */
export const LEAD_CHARACTERS: Asset[] = [
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

export const LEAD_IDS = new Set(LEAD_CHARACTERS.map(c => c.id))

/**
 * Retorna o lead character (só leitura) por id, ou undefined se não existir.
 */
export function getLead(id: string): Asset | undefined {
  return LEAD_CHARACTERS.find(c => c.id === id)
}

/**
 * Verifica se um id pertence a um lead (e portanto não pode ser deletado).
 */
export function isLeadId(id: string): boolean {
  return LEAD_IDS.has(id)
}

/**
 * Emoji padrão por tipo — usado quando o Asset não tem emoji próprio.
 */
export function defaultEmoji(type: AssetType): string {
  if (type === 'character') return '👤'
  if (type === 'scenario') return '🏞'
  return '🧺'
}

/**
 * Mescla os leads com os assets custom vindos do Redis.
 * Leads sempre vêm primeiro na lista. Se o Redis tiver um asset com id
 * igual a um lead (ex: refs extras do @abraao), as imageUrls dele são
 * anexadas ao lead — esse é o path de compatibilidade com o library[charId]
 * antigo (resolvido no route handler, não aqui).
 */
export function mergeWithLeads(customAssets: Asset[]): Asset[] {
  const leadIds = new Set(LEAD_CHARACTERS.map(c => c.id))
  const customOnly = customAssets.filter(a => !leadIds.has(a.id))
  return [...LEAD_CHARACTERS, ...customOnly]
}
