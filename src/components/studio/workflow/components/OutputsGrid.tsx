'use client'

import React from 'react'
import { wfColors, wfRadius } from '../theme/workflowTheme'

/**
 * Grid de outputs gerados (imagens ou video thumbs) dentro de um nó
 * gerador. Cada output é clicável pra marcar como "selecionado" (o
 * que alimenta o handle de saída downstream).
 *
 * O número de colunas adapta ao total: 1=1col, 2=2cols, 4=2x2.
 * Cada célula respeita o aspect ratio informado — o container visual
 * do nó acompanha o ratio sendo gerado.
 *
 * Stateless. Recebe `outputs`, `selectedIndex`, callbacks.
 */

export interface OutputItem {
  url: string
  alt?: string
}

export interface OutputsGridProps {
  outputs: OutputItem[]
  selectedIndex: number
  onSelect: (index: number) => void
  onDelete?: (index: number) => void
  /** CSS aspect-ratio ex: '1 / 1', '16 / 9', '9 / 16' */
  cellAspect: string
  accent: string
  /** Renderização como `video` tag em vez de `img` */
  isVideo?: boolean
}

export function OutputsGrid({
  outputs,
  selectedIndex,
  onSelect,
  onDelete,
  cellAspect,
  accent,
  isVideo = false,
}: OutputsGridProps) {
  if (outputs.length === 0) return null

  const cols = outputs.length === 1 ? 1 : 2

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 6,
      }}
    >
      {outputs.map((o, idx) => {
        const selected = idx === selectedIndex
        return (
          <div
            key={`${o.url}-${idx}`}
            onClick={() => onSelect(idx)}
            style={{
              position: 'relative',
              aspectRatio: cellAspect,
              borderRadius: wfRadius.control,
              overflow: 'hidden',
              cursor: 'pointer',
              border: `2px solid ${selected ? accent : 'transparent'}`,
              boxShadow: selected ? `0 0 0 2px ${accent}33` : 'none',
              background: wfColors.surfaceDeep,
              transition: 'border-color 120ms ease, box-shadow 120ms ease',
            }}
          >
            {isVideo ? (
              <video
                src={o.url}
                controls
                preload="metadata"
                playsInline
                className="nodrag nowheel"
                style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
              />
            ) : (
              <img src={o.url} alt={o.alt ?? `Output ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            {selected && (
              <div style={{
                position: 'absolute', top: 3, left: 3,
                padding: '1px 5px', borderRadius: 3,
                background: accent, color: '#0A0814',
                fontSize: 9, fontWeight: 700,
                letterSpacing: 0.3,
              }}>
                ★
              </div>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(idx) }}
                title="Descartar"
                className="nodrag"
                style={{
                  position: 'absolute', top: 3, right: 3,
                  width: 18, height: 18, padding: 0,
                  background: 'rgba(10,8,20,0.7)', border: 'none',
                  borderRadius: 3, color: '#ff5d7a',
                  fontSize: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            )}
          </div>
        )
      })}
    </div>
  )
}
