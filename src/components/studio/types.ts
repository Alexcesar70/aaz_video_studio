/**
 * Tipos compartilhados pelo Studio, extraídos de AAZStudio.tsx (M2-PR7).
 *
 * Estes types são específicos da UI do Studio — distintos dos tipos
 * de domínio em `@/modules/*`. Eles espelham o shape que a UI precisa
 * para renderizar listas/cards, e podem futuramente ser mapeados a
 * partir de entidades do domínio (Character, ReferenceAsset, etc.).
 *
 * Pattern:
 *   import type { SceneAsset, Episode } from '@/components/studio/types'
 */

import type { MoodId } from '@/lib/moods'

/** Usuário autenticado atual (vem de /api/auth/me). */
export type CurrentUser = {
  id: string
  email: string
  name: string
  role: 'super_admin' | 'admin' | 'creator'
  workspaceName?: string
  permissions?: string[]
  products?: string[]
}

export interface Character {
  id: string
  name: string
  emoji: string
  color: string
  desc: string
}

export interface RefItem {
  url: string
  label: string
  name: string
  fromLib?: boolean
  charId?: string
}

export interface LibraryEntry {
  charId: string
  name: string
  emoji: string
  images: string[]
  createdAt: string
  createdBy?: string
}

export interface ScenarioEntry {
  id: string
  name: string
  imageUrl: string
  createdAt: string
}

export interface Project {
  id: string
  name: string
  createdAt: string
  createdBy?: string
  memberIds?: string[]
}

export interface Episode {
  id: string
  name: string
  projectId?: string | null
  createdAt: string
  createdBy?: string
  finalVideoUrl?: string
  finalVideoSizeMB?: number
  finalVideoUploadedAt?: string
  finalVideoUploadedBy?: string
  finalStatus?: 'none' | 'pending_review' | 'approved' | 'needs_changes'
  reviewNote?: string
  reviewedAt?: string
  reviewedBy?: string
  creatorNote?: string
}

export type SceneStatus = 'draft' | 'approved' | 'rejected'

export interface SceneAsset {
  id: string
  episodeId: string | null
  sceneNumber: number
  title?: string
  prompt: string
  videoUrl: string
  lastFrameUrl: string
  characters: string[]
  duration: number
  cost: string
  createdAt: string
  projectId?: string | null
  status?: SceneStatus
  mood?: MoodId
  setting?: string
  emotion?: string
  createdBy?: string
}

export interface HistoryItem {
  id: number
  prompt: string
  chars: string
  mode: string
  ratio: string
  duration: number
  cost: string
  url: string
  timestamp: string
}
