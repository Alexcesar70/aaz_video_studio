/**
 * Modelos de dados do AAZ Production Studio
 * Hierarquia: Projeto (opcional) → Episódio → Cena → Shot → Version
 */

export interface Project {
  id: string
  name: string
  description?: string
  createdAt: string
}

export type EpisodeStatus = 'rascunho' | 'em_producao' | 'finalizado'

export interface Episode {
  id: string
  title: string
  synopsis: string
  projectId: string | null   // null = episódio avulso
  characterIds: string[]     // elenco principal (planejamento narrativo)
  status: EpisodeStatus
  createdAt: string
}

export interface Scene {
  id: string
  episodeId: string
  name: string
  order: number
  characterIds: string[]     // personagens presentes nesta cena
  scenarioId: string | null  // localização (referência à Biblioteca de Cenários)
  generalAction: string      // ação geral herdada pelos shots
  createdAt: string
}

export type CameraMode = 'fixed' | 'movement'

export type ShotEmotion =
  | 'tensao' | 'surpresa' | 'alegria' | 'culpa'
  | 'curiosidade' | 'reflexao' | 'conflito' | 'resolucao' | 'outro'

export type VersionStatus = 'gerado' | 'aprovado' | 'rejeitado'

export interface Version {
  id: string
  timestamp: string
  prompt_pt: string
  prompt_en: string
  videoUrl: string
  status: VersionStatus
}

export interface Shot {
  id: string
  sceneId: string
  episodeId: string
  order: number
  action: string             // ação específica do beat (max 200 chars)
  emotion: ShotEmotion
  emotionCustom?: string     // se emotion === 'outro'
  cameraMode: CameraMode
  cameraFixed?: string       // se cameraMode === 'fixed'
  cameraMovement?: string    // se cameraMode === 'movement'
  duration: number
  ratio: string
  versions: Version[]
  activeVersionId: string | null
  createdAt: string
}

/* ── Biblioteca (existentes, inalterados) ── */

export interface LibraryCharacter {
  charId: string
  name: string
  emoji: string
  images: string[]
  createdAt: string
}

export interface LibraryScenario {
  id: string
  name: string
  imageUrl: string
  createdAt: string
}
