'use client'

/**
 * Mapeamento semântico tipo → componente de ícone. Única fonte de
 * verdade pra todos os usos do Workflow (headers de nó, sidebar
 * global, toolbar do canvas, actions). Trocar biblioteca no futuro
 * exige mexer só aqui.
 *
 * Origem: Bear Studio Icon Kit (handoff do design). SVGs gerados em
 * `./icons/bearIcons.tsx` a partir de `./icons/_manifest.json`.
 */

import {
  // blocks (tipos de nó)
  TextBlockIcon,
  ImageGeneratorIcon,
  VideoGeneratorIcon,
  CreationIcon,
  AudioGeneratorIcon,
  ThreeDGeneratorIcon,
  PromptEnhanceIcon,
  MaskIcon,
  StyleReferenceIcon,
  CharacterIcon,
  SceneIcon,
  // toolbar (ações)
  PlayIcon,
  PauseIcon,
  ExpandIcon,
  CollapseIcon,
  LockIcon,
  UnlockIcon,
  DuplicateIcon,
  DeleteIcon,
  DownloadIcon,
  UploadIcon,
  HistoryIcon,
  RegenerateIcon,
  UndoIcon,
  RedoIcon,
  // ports (handles tipados — PR 3)
  PortTextIcon,
  PortImageIcon,
  PortVideoIcon,
  PortAudioIcon,
  PortMaskIcon,
  ConnectorInIcon,
  ConnectorOutIcon,
  // prompt (controles)
  AspectRatioIcon,
  ModelIcon,
  MinusIcon,
  PlusIcon,
  SendIcon,
  AttachIcon,
  SeedIcon,
  FramesIcon,
  // nav (UI geral)
  InfoIcon,
  SettingsIcon,
  SearchIcon,
  UserIcon,
  LayersIcon,
  GridIcon,
  CloseIcon,
  CheckIcon,
  ChevronDownIcon,
  MoreIcon,
} from './icons/bearIcons'
import type { BearIconProps } from './icons/BearIcon'
import type { NodeType } from '@/modules/workflow'

export type { BearIconProps }
export type IconComponent = (props: BearIconProps) => JSX.Element

// ─── Tipo de nó ──────────────────────────────────────────────────────
export const NODE_TYPE_ICONS: Record<NodeType, IconComponent> = {
  note: TextBlockIcon,
  prompt: PromptEnhanceIcon,
  image: ImageGeneratorIcon,
  video: VideoGeneratorIcon,
  reference: StyleReferenceIcon,
  character: CharacterIcon,
  scenario: SceneIcon,
  audio: AudioGeneratorIcon,
  group: LayersIcon,
  task: CheckIcon,
}

// ─── Ações por nó ────────────────────────────────────────────────────
export const ActionIcons = {
  duplicate: DuplicateIcon,
  delete: DeleteIcon,
  editUrl: AttachIcon,
  download: DownloadIcon,
  openLink: ExpandIcon,
  run: PlayIcon,
  pause: PauseIcon,
  regenerate: RegenerateIcon,
  lock: LockIcon,
  unlock: UnlockIcon,
  undo: UndoIcon,
  redo: RedoIcon,
  history: HistoryIcon,
  upload: UploadIcon,
  more: MoreIcon,
} as const

// ─── Navegação global ────────────────────────────────────────────────
// Mapeia itens da sidebar para ícones do kit. Alguns itens do menu não
// têm equivalente direto no pack — usamos o mais próximo semanticamente.
export const NavIcons = {
  home: GridIcon,
  studio: CreationIcon,
  creators: PromptEnhanceIcon,
  projects: LayersIcon,
  assets: StyleReferenceIcon,
  music: AudioGeneratorIcon,
  voices: SendIcon,
  workflow: ConnectorOutIcon,
  admin: SettingsIcon,
  team: UserIcon,
  settings: SettingsIcon,
  profile: UserIcon,
  logout: CloseIcon,
} as const

// ─── Portas tipadas (PR 3 — handles) ─────────────────────────────────
export const PortIcons = {
  text: PortTextIcon,
  image: PortImageIcon,
  video: PortVideoIcon,
  audio: PortAudioIcon,
  mask: PortMaskIcon,
  connectorIn: ConnectorInIcon,
  connectorOut: ConnectorOutIcon,
} as const

// ─── UI geral ────────────────────────────────────────────────────────
export const UIIcons = {
  search: SearchIcon,
  chevronLeft: ChevronDownIcon, // rotacionado via CSS quando precisa
  chevronRight: ChevronDownIcon,
  chevronDown: ChevronDownIcon,
  plus: PlusIcon,
  minus: MinusIcon,
  close: CloseIcon,
  check: CheckIcon,
  info: InfoIcon,
  more: MoreIcon,
  refine: PromptEnhanceIcon,
  send: SendIcon,
  attach: AttachIcon,
  aspectRatio: AspectRatioIcon,
  model: ModelIcon,
  seed: SeedIcon,
  frames: FramesIcon,
} as const

/**
 * Props padrão — strokeWidth já vem do BearIcon base (1.25). Mantido
 * por compatibilidade com chamadores antigos que spread DEFAULT_ICON_PROPS.
 */
export const DEFAULT_ICON_PROPS: Partial<BearIconProps> = {}

export function getNodeTypeIcon(type: NodeType): IconComponent {
  return NODE_TYPE_ICONS[type] ?? TextBlockIcon
}
