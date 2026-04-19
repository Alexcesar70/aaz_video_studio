'use client'

import React from 'react'
import { wfColors, wfRadius } from '../theme/workflowTheme'
import { NODE_TYPE_ICONS, DEFAULT_ICON_PROPS } from '../theme/icons'

/**
 * Chip que mostra uma REFERÊNCIA anexada ao nó (seja por upload local
 * ou por cabo conectado upstream). Visualmente é uma pill com
 * thumbnail pequeno + label + botão opcional de remover.
 *
 * Uso:
 * - ImageNode mostra chip da `referenceImageUrl`
 * - VideoNode mostra chips dos frames (start/end) + video ref + audio ref
 *
 * Quando `onRemove` é passado, renderiza o X pra clear. Quando não
 * (ex: upstream via cabo — não dá pra desconectar aqui), o chip fica
 * só informativo.
 */

export interface ReferenceChipProps {
  url: string
  kind: 'image' | 'video' | 'audio'
  label: string
  accent: string
  /** Se passado, renderiza botão X pra remover. Omitir = chip informativo. */
  onRemove?: () => void
  /** Indica que vem de cabo upstream (estilo levemente diferente) */
  fromUpstream?: boolean
}

export function ReferenceChip({
  url, kind, label, accent, onRemove, fromUpstream = false,
}: ReferenceChipProps) {
  return (
    <div
      title={`${label}${fromUpstream ? ' (via cabo)' : ''}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '2px 7px 2px 2px',
        background: fromUpstream ? `${accent}12` : `${accent}20`,
        border: `1px solid ${fromUpstream ? `${accent}40` : `${accent}66`}`,
        borderRadius: wfRadius.control,
        maxWidth: '100%',
      }}
    >
      {/* Thumbnail */}
      {kind === 'image' && (
        <img
          src={url}
          alt={label}
          style={{
            width: 22, height: 22, borderRadius: 3,
            objectFit: 'cover', flexShrink: 0,
            background: wfColors.surfaceDeep,
          }}
        />
      )}
      {kind === 'video' && (
        <div style={{
          width: 22, height: 22, borderRadius: 3,
          background: wfColors.surfaceDeep,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {(() => {
            const I = NODE_TYPE_ICONS.video
            return <I size={11} color={accent} {...DEFAULT_ICON_PROPS} />
          })()}
        </div>
      )}
      {kind === 'audio' && (
        <div style={{
          width: 22, height: 22, borderRadius: 3,
          background: wfColors.surfaceDeep,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {(() => {
            const I = NODE_TYPE_ICONS.audio
            return <I size={11} color={accent} {...DEFAULT_ICON_PROPS} />
          })()}
        </div>
      )}

      {/* Label */}
      <span style={{
        fontSize: 9, color: accent, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 0.3,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {label}{fromUpstream ? ' ↗' : ''}
      </span>

      {/* Remove button (só se onRemove) */}
      {onRemove && (
        <button
          onClick={onRemove}
          title="Remover"
          className="nodrag"
          style={{
            width: 14, height: 14, padding: 0, marginLeft: 2,
            background: 'transparent', border: 'none',
            color: wfColors.textDim, cursor: 'pointer',
            fontSize: 11, lineHeight: 1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      )}
    </div>
  )
}
