'use client'

/**
 * Ícones do Bear Studio Icon Kit (handoff do design).
 * 50 ícones organizados em 5 grupos (blocks / toolbar / ports /
 * prompt / nav). Gerados a partir de _manifest.json — fonte única
 * de verdade em `theme/icons/_manifest.json` (preservado no repo
 * pra regeneração futura).
 *
 * Cada ícone compõe <BearIcon> e aceita a mesma API (size, color,
 * strokeWidth). Stroke-linecap/join arredondados já vêm do base.
 */

import React from 'react'
import { BearIcon, type BearIconProps } from './BearIcon'



// ─── blocks ─────────────────────────────────────────────────────────

/** Text (text-block) */
export const TextBlockIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M6 8V6h12v2"/>
    <path d="M12 6v12"/>
    <path d="M9 18h6"/>
  </BearIcon>
)

/** Image Generator (image-generator) */
export const ImageGeneratorIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <rect x="4" y="5" width="16" height="14" rx="2"/>
    <circle cx="9" cy="10" r="1.4"/>
    <path d="M4 16l4.5-4 3.5 3 3-2.5L20 16"/>
  </BearIcon>
)

/** Video Generator (video-generator) */
export const VideoGeneratorIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <rect x="3" y="6" width="13" height="12" rx="2"/>
    <path d="M16 10l5-2.5v9L16 14z"/>
  </BearIcon>
)

/** Creation (creation) */
export const CreationIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>
  </BearIcon>
)

/** Audio (audio-generator) */
export const AudioGeneratorIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M5 10v4"/>
    <path d="M8.5 7v10"/>
    <path d="M12 4v16"/>
    <path d="M15.5 7v10"/>
    <path d="M19 10v4"/>
  </BearIcon>
)

/** 3D (3d-generator) */
export const ThreeDGeneratorIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/>
    <path d="M4 7.5L12 12l8-4.5"/>
    <path d="M12 12v9"/>
  </BearIcon>
)

/** Enhance (prompt-enhance) */
export const PromptEnhanceIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M5 19l6-6"/>
    <path d="M13 5l1.2 2.8L17 9l-2.8 1.2L13 13l-1.2-2.8L9 9l2.8-1.2z"/>
    <path d="M18 15l.6 1.4L20 17l-1.4.6L18 19l-.6-1.4L16 17l1.4-.6z"/>
  </BearIcon>
)

/** Mask (mask) */
export const MaskIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <circle cx="10" cy="12" r="6"/>
    <circle cx="15" cy="12" r="6"/>
  </BearIcon>
)

/** Style Ref (style-reference) */
export const StyleReferenceIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <rect x="4" y="4" width="11" height="11" rx="1.5"/>
    <rect x="9" y="9" width="11" height="11" rx="1.5"/>
  </BearIcon>
)

/** Character (character) */
export const CharacterIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <circle cx="12" cy="8.5" r="3.5"/>
    <path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>
  </BearIcon>
)

/** Scene (scene) */
export const SceneIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <rect x="3" y="6" width="18" height="12" rx="1.5"/>
    <path d="M3 14l5-4 4 3 3-2 6 4"/>
    <circle cx="17" cy="9" r="1.2"/>
  </BearIcon>
)


// ─── toolbar ─────────────────────────────────────────────────────────

/** Play (play) */
export const PlayIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M8 5.5v13l11-6.5z"/>
  </BearIcon>
)

/** Pause (pause) */
export const PauseIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M9 5v14"/>
    <path d="M15 5v14"/>
  </BearIcon>
)

/** Expand (expand) */
export const ExpandIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M4 9V4h5"/>
    <path d="M20 9V4h-5"/>
    <path d="M4 15v5h5"/>
    <path d="M20 15v5h-5"/>
  </BearIcon>
)

/** Collapse (collapse) */
export const CollapseIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M9 4v5H4"/>
    <path d="M15 4v5h5"/>
    <path d="M9 20v-5H4"/>
    <path d="M15 20v-5h5"/>
  </BearIcon>
)

/** Lock (lock) */
export const LockIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <rect x="5" y="10" width="14" height="10" rx="1.5"/>
    <path d="M8 10V7a4 4 0 018 0v3"/>
  </BearIcon>
)

/** Unlock (unlock) */
export const UnlockIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <rect x="5" y="10" width="14" height="10" rx="1.5"/>
    <path d="M8 10V7a4 4 0 017-2.5"/>
  </BearIcon>
)

/** Duplicate (duplicate) */
export const DuplicateIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <rect x="8" y="8" width="12" height="12" rx="1.5"/>
    <path d="M16 8V5.5A1.5 1.5 0 0014.5 4h-9A1.5 1.5 0 004 5.5v9A1.5 1.5 0 005.5 16H8"/>
  </BearIcon>
)

/** Delete (delete) */
export const DeleteIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M4 7h16"/>
    <path d="M10 11v6"/>
    <path d="M14 11v6"/>
    <path d="M6 7l1 12.5A1.5 1.5 0 008.5 21h7a1.5 1.5 0 001.5-1.5L18 7"/>
    <path d="M9 7V4.5A.5.5 0 019.5 4h5a.5.5 0 01.5.5V7"/>
  </BearIcon>
)

/** Download (download) */
export const DownloadIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M12 4v12"/>
    <path d="M7 11l5 5 5-5"/>
    <path d="M4 20h16"/>
  </BearIcon>
)

/** Upload (upload) */
export const UploadIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M12 20V8"/>
    <path d="M7 13l5-5 5 5"/>
    <path d="M4 4h16"/>
  </BearIcon>
)

/** History (history) */
export const HistoryIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M4 12a8 8 0 108-8 8 8 0 00-6 2.7"/>
    <path d="M4 4v4h4"/>
    <path d="M12 8v4l3 2"/>
  </BearIcon>
)

/** Regenerate (regenerate) */
export const RegenerateIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M4 12a8 8 0 0114-5.3"/>
    <path d="M18 3v4h-4"/>
    <path d="M20 12a8 8 0 01-14 5.3"/>
    <path d="M6 21v-4h4"/>
  </BearIcon>
)

/** Undo (undo) */
export const UndoIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M9 14L4 9l5-5"/>
    <path d="M4 9h10a6 6 0 010 12h-3"/>
  </BearIcon>
)

/** Redo (redo) */
export const RedoIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M15 14l5-5-5-5"/>
    <path d="M20 9H10a6 6 0 000 12h3"/>
  </BearIcon>
)


// ─── ports ─────────────────────────────────────────────────────────

/** Text port (port-text) */
export const PortTextIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <circle cx="12" cy="12" r="8"/>
    <path d="M8 10h8"/>
    <path d="M8 14h5"/>
  </BearIcon>
)

/** Image port (port-image) */
export const PortImageIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <circle cx="12" cy="12" r="8"/>
    <rect x="8" y="8.5" width="8" height="7" rx="1"/>
    <path d="M8 13.5l2.5-2 2 1.5 1.5-1 2 1.5"/>
  </BearIcon>
)

/** Video port (port-video) */
export const PortVideoIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <circle cx="12" cy="12" r="8"/>
    <path d="M10 9.5v5l4.5-2.5z"/>
  </BearIcon>
)

/** Audio port (port-audio) */
export const PortAudioIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <circle cx="12" cy="12" r="8"/>
    <path d="M9 11v2"/>
    <path d="M11.5 9.5v5"/>
    <path d="M14 11v2"/>
  </BearIcon>
)

/** Mask port (port-mask) */
export const PortMaskIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <circle cx="12" cy="12" r="8"/>
    <circle cx="10.5" cy="12" r="3"/>
    <circle cx="13.5" cy="12" r="3"/>
  </BearIcon>
)

/** Input (connector-in) */
export const ConnectorInIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M3 12h6"/>
  </BearIcon>
)

/** Output (connector-out) */
export const ConnectorOutIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M15 12h6"/>
  </BearIcon>
)


// ─── prompt ─────────────────────────────────────────────────────────

/** Aspect ratio (aspect-ratio) */
export const AspectRatioIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <rect x="4" y="6" width="16" height="12" rx="1.5"/>
    <path d="M9 10h6v4"/>
  </BearIcon>
)

/** Model (model) */
export const ModelIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 5v2"/>
    <path d="M12 17v2"/>
    <path d="M5 12h2"/>
    <path d="M17 12h2"/>
    <path d="M7.05 7.05l1.4 1.4"/>
    <path d="M15.55 15.55l1.4 1.4"/>
    <path d="M7.05 16.95l1.4-1.4"/>
    <path d="M15.55 8.45l1.4-1.4"/>
  </BearIcon>
)

/** Minus (minus) */
export const MinusIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M5 12h14"/>
  </BearIcon>
)

/** Plus (plus) */
export const PlusIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M12 5v14"/>
    <path d="M5 12h14"/>
  </BearIcon>
)

/** Send (send) */
export const SendIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <circle cx="12" cy="12" r="9"/>
    <path d="M10 8.5l4 3.5-4 3.5z"/>
  </BearIcon>
)

/** Attach (attach) */
export const AttachIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M19 11l-7.5 7.5a4.5 4.5 0 01-6.4-6.4L13 3.7a3 3 0 014.3 4.3L9.4 16"/>
  </BearIcon>
)

/** Seed (seed) */
export const SeedIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <circle cx="12" cy="12" r="8"/>
    <path d="M12 7v10"/>
    <path d="M8.5 9.5l7 5"/>
    <path d="M8.5 14.5l7-5"/>
  </BearIcon>
)

/** Frames (frames) */
export const FramesIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <rect x="3" y="7" width="5" height="10" rx="0.8"/>
    <rect x="9.5" y="7" width="5" height="10" rx="0.8"/>
    <rect x="16" y="7" width="5" height="10" rx="0.8"/>
  </BearIcon>
)


// ─── nav ─────────────────────────────────────────────────────────

/** Info (info) */
export const InfoIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 11v5"/>
    <circle cx="12" cy="8.5" r="0.6" fill="currentColor" stroke="none"/>
  </BearIcon>
)

/** Settings (settings) */
export const SettingsIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 3v2"/>
    <path d="M12 19v2"/>
    <path d="M3 12h2"/>
    <path d="M19 12h2"/>
    <path d="M5.6 5.6l1.4 1.4"/>
    <path d="M17 17l1.4 1.4"/>
    <path d="M5.6 18.4L7 17"/>
    <path d="M17 7l1.4-1.4"/>
  </BearIcon>
)

/** Search (search) */
export const SearchIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <circle cx="11" cy="11" r="6.5"/>
    <path d="M16 16l4 4"/>
  </BearIcon>
)

/** User (user) */
export const UserIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <circle cx="12" cy="8" r="3.5"/>
    <path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/>
  </BearIcon>
)

/**
 * Users (dois usuários — time). Mantém o mesmo estilo do UserIcon:
 * pessoa principal à esquerda, segunda pessoa sobreposta atrás à
 * direita. Sinaliza "mais de uma pessoa" sem poluir visual.
 */
export const UsersIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <circle cx="9.5" cy="8.5" r="3"/>
    <path d="M3.5 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/>
    <circle cx="16.5" cy="6.5" r="2.3"/>
    <path d="M14.5 14.2c3 .4 5 2.6 5 5.8"/>
  </BearIcon>
)

/** Layers (layers) */
export const LayersIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M12 3l9 5-9 5-9-5z"/>
    <path d="M3 13l9 5 9-5"/>
    <path d="M3 17l9 5 9-5"/>
  </BearIcon>
)

/** Grid (grid) */
export const GridIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <rect x="4" y="4" width="7" height="7" rx="1"/>
    <rect x="13" y="4" width="7" height="7" rx="1"/>
    <rect x="4" y="13" width="7" height="7" rx="1"/>
    <rect x="13" y="13" width="7" height="7" rx="1"/>
  </BearIcon>
)

/** Close (close) */
export const CloseIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M6 6l12 12"/>
    <path d="M18 6L6 18"/>
  </BearIcon>
)

/** Check (check) */
export const CheckIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M4 12.5l5 5L20 7"/>
  </BearIcon>
)

/** Chevron (chevron-down) */
export const ChevronDownIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <path d="M6 10l6 6 6-6"/>
  </BearIcon>
)

/** More (more) */
export const MoreIcon = (props: BearIconProps) => (
  <BearIcon {...props}>
    <circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>
    <circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none"/>
  </BearIcon>
)
