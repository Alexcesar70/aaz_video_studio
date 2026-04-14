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
  /** ID do usuário que criou (multi-user). 'legacy' pra dados antigos. */
  createdBy?: string
  /** Organização dona do asset (multi-tenant Phase 2) */
  organizationId?: string
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
 *
 * A fonte da verdade dos dados foi movida para
 * `src/modules/library/seeds/aazLeadCharacters.ts` (PR #4) — este re-export
 * existe só para retrocompat de imports legados e desaparece quando o PR #9
 * consolidar o refactor. Novo código deve importar de @/modules/library.
 */
import { AAZ_LEAD_CHARACTERS } from '@/modules/library/seeds/aazLeadCharacters'
export const LEAD_CHARACTERS: Asset[] = AAZ_LEAD_CHARACTERS

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
