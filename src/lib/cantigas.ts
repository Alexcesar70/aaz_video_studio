/**
 * Modelo de Cantigas — projeto completo de cantiga infantil.
 *
 * Cada cantiga é um projeto que passa por etapas:
 * lyrics → music → storyboard → assets → producing → completed
 *
 * Redis keys:
 *  - aaz:cantiga:{orgId}:{id}  → Cantiga JSON
 */

import { getRedis } from './redis'

const PREFIX = 'aaz:cantiga:'

export type CantigaStatus = 'lyrics' | 'music' | 'storyboard' | 'assets' | 'producing' | 'completed'

export interface CantigaAssetRef {
  charId?: string
  id: string
  nome: string
  sheetId?: string
  assetId?: string
  status: 'pending' | 'ready'
}

export interface CantigaCena {
  cena: number
  trecho: string
  duracao: number
  personagens: string[]
  cenario: string
  acao: string
  prompt_en: string
  assets: {
    personagens: CantigaAssetRef[]
    cenarios: CantigaAssetRef[]
    props: CantigaAssetRef[]
  }
  videoUrl?: string
  videoStatus: 'pending' | 'generating' | 'ready'
}

export interface Cantiga {
  id: string
  title: string
  status: CantigaStatus
  step: number
  createdBy: string
  organizationId?: string
  createdAt: string
  updatedAt: string
  // Passo 1
  idea: string
  theme: string
  characters: string[]
  lyrics: string
  musicDuration: string
  refraoCount: number
  useRhyme: boolean
  // Passo 2
  musicUrl: string
  musicStyle: string
  // Passo 3
  storyboard: CantigaCena[]
}

function key(orgId: string | undefined, id: string): string {
  return `${PREFIX}${orgId ?? 'global'}:${id}`
}

function pattern(orgId: string | undefined): string {
  return `${PREFIX}${orgId ?? 'global'}:*`
}

export async function createCantiga(data: Omit<Cantiga, 'id' | 'createdAt' | 'updatedAt'>): Promise<Cantiga> {
  const redis = await getRedis()
  const id = `cantiga_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const now = new Date().toISOString()
  const cantiga: Cantiga = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  }
  await redis.set(key(data.organizationId, id), JSON.stringify(cantiga))
  return cantiga
}

export async function getCantiga(orgId: string | undefined, id: string): Promise<Cantiga | null> {
  const redis = await getRedis()
  const val = await redis.get(key(orgId, id))
  if (!val) return null
  try { return JSON.parse(val) as Cantiga } catch { return null }
}

export async function updateCantiga(orgId: string | undefined, id: string, updates: Partial<Cantiga>): Promise<Cantiga | null> {
  const existing = await getCantiga(orgId, id)
  if (!existing) return null
  const redis = await getRedis()
  const updated: Cantiga = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    createdBy: existing.createdBy,
    updatedAt: new Date().toISOString(),
  }
  await redis.set(key(orgId, id), JSON.stringify(updated))
  return updated
}

export async function deleteCantiga(orgId: string | undefined, id: string): Promise<boolean> {
  const redis = await getRedis()
  const result = await redis.del(key(orgId, id))
  return result > 0
}

export async function listCantigas(orgId: string | undefined, createdBy?: string): Promise<Cantiga[]> {
  const redis = await getRedis()
  const keys = await redis.keys(pattern(orgId))
  const cantigas: Cantiga[] = []
  for (const k of keys) {
    const val = await redis.get(k)
    if (!val) continue
    try {
      const c = JSON.parse(val) as Cantiga
      if (createdBy && c.createdBy !== createdBy) continue
      cantigas.push(c)
    } catch {}
  }
  return cantigas.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** Calcula progresso da cantiga (0-100). */
export function cantigaProgress(c: Cantiga): number {
  let total = 5 // 5 etapas possíveis
  let done = 0
  if (c.lyrics) done++
  if (c.musicUrl) done++
  if (c.storyboard?.length > 0 && c.storyboard.some(s => s.prompt_en)) done++
  if (c.storyboard?.length > 0) {
    const allAssets = c.storyboard.flatMap(s => [
      ...(s.assets?.personagens ?? []),
      ...(s.assets?.cenarios ?? []),
      ...(s.assets?.props ?? []),
    ])
    if (allAssets.length === 0 || allAssets.every(a => a.status === 'ready')) done++
  }
  if (c.storyboard?.length > 0 && c.storyboard.every(s => s.videoStatus === 'ready')) done++
  return Math.round((done / total) * 100)
}

/** Retorna label do status em PT-BR. */
export function cantigaStatusLabel(status: CantigaStatus): string {
  switch (status) {
    case 'lyrics': return 'Escrevendo letra'
    case 'music': return 'Gerando música'
    case 'storyboard': return 'Criando roteiro'
    case 'assets': return 'Criando assets'
    case 'producing': return 'Produzindo cenas'
    case 'completed': return 'Completa'
  }
}
