'use client'

/**
 * Mapeamento semântico tipo → componente de ícone. Única fonte de
 * verdade pra todos os usos do Workflow (headers de nó, sidebar
 * global, toolbar do canvas, actions). Trocar biblioteca no futuro
 * exige mexer só aqui.
 *
 * Estilo: Lucide (SVG outline, linha fina ~ 1.5px, geométrico —
 * próximo do SF Symbols). Renderização sem preenchimento.
 */

import {
  // Tipos de nó
  StickyNote,
  Sparkles,
  Image as LucideImage,
  Film,
  Link2,
  User,
  MountainSnow,
  Music4,
  Package,
  CheckSquare,
  // Ações
  Copy,
  Trash2,
  Pencil,
  Download,
  ExternalLink,
  Play,
  // Navegação
  Home,
  Clapperboard,
  Target,
  FolderOpen,
  Palette,
  Mic,
  Workflow as WorkflowIcon,
  Crown,
  Users,
  Settings,
  UserCircle2,
  LogOut,
  // Utilitários
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  MoreHorizontal,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { NodeType } from '@/modules/workflow'

export type IconComponent = LucideIcon

// ─── Tipo de nó ──────────────────────────────────────────────────────
export const NODE_TYPE_ICONS: Record<NodeType, LucideIcon> = {
  note: StickyNote,
  prompt: Sparkles,
  image: LucideImage,
  video: Film,
  reference: Link2,
  character: User,
  scenario: MountainSnow,
  audio: Music4,
  group: Package,
  task: CheckSquare,
}

// ─── Ações por nó ────────────────────────────────────────────────────
export const ActionIcons = {
  duplicate: Copy,
  delete: Trash2,
  editUrl: Pencil,
  download: Download,
  openLink: ExternalLink,
  run: Play,
  more: MoreHorizontal,
} as const

// ─── Navegação global ────────────────────────────────────────────────
export const NavIcons = {
  home: Home,
  studio: Clapperboard,
  creators: Target,
  projects: FolderOpen,
  assets: Palette,
  music: Music4,
  voices: Mic,
  workflow: WorkflowIcon,
  admin: Crown,
  team: Users,
  settings: Settings,
  profile: UserCircle2,
  logout: LogOut,
} as const

// ─── UI geral ────────────────────────────────────────────────────────
export const UIIcons = {
  search: Search,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  plus: Plus,
  close: X,
  refine: Zap,
} as const

/**
 * Props padrão dos ícones do app — stroke fino ~1.75 pra aparência
 * requintada, monocromático por default.
 */
export const DEFAULT_ICON_PROPS = {
  strokeWidth: 1.75,
  absoluteStrokeWidth: true,
} as const

export function getNodeTypeIcon(type: NodeType): LucideIcon {
  return NODE_TYPE_ICONS[type] ?? StickyNote
}
