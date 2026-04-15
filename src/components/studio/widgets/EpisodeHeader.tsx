'use client'

/**
 * EpisodeHeader — cabeçalho com nome editável + ações do episódio.
 * Extraído de AAZStudio.tsx (M5-PR6).
 */

import React, { useState } from 'react'
import { C } from '../theme'
import { Input } from '../atoms'
import type { Episode } from '../types'

interface Props {
  episode: Episode
  count: number
  onMove: (e: Episode) => void
  onDelete: (e: Episode) => void
  onPlaySequential?: (e: Episode) => void
  onRename: (episodeId: string, newName: string) => void
}

export function EpisodeHeader({
  episode,
  count,
  onMove,
  onDelete,
  onPlaySequential,
  onRename,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const name = episode.name?.trim() || '(sem nome)'

  const commit = () => {
    if (draft.trim()) onRename(episode.id, draft)
    setEditing(false)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
        flexWrap: 'wrap',
      }}
    >
      {editing ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            else if (e.key === 'Escape') setEditing(false)
          }}
          style={{ maxWidth: 260, padding: '6px 10px', fontSize: 13 }}
        />
      ) : (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.textDim, margin: 0 }}>
            🎬 {name} <span style={{ opacity: 0.6 }}>({count})</span>
          </h3>
          <button
            onClick={() => {
              setDraft(episode.name?.trim() || '')
              setEditing(true)
            }}
            title="Renomear episódio"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: C.textDim,
              fontSize: 12,
              padding: 2,
              fontFamily: 'inherit',
            }}
          >
            ✎
          </button>
        </>
      )}
      {onPlaySequential && count >= 2 && (
        <button
          onClick={() => onPlaySequential(episode)}
          title="Assistir todas as cenas do episódio em sequência"
          style={{
            background: C.purpleGlow,
            border: `1px solid ${C.purple}50`,
            borderRadius: 6,
            padding: '3px 10px',
            cursor: 'pointer',
            color: C.purple,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'inherit',
          }}
        >
          ▶ Assistir episódio
        </button>
      )}
      <button
        onClick={() => onMove(episode)}
        title="Mover episódio para outro projeto"
        style={{
          background: `${C.gold}15`,
          border: `1px solid ${C.gold}40`,
          borderRadius: 6,
          padding: '3px 8px',
          cursor: 'pointer',
          color: C.gold,
          fontSize: 11,
          fontFamily: 'inherit',
        }}
      >
        ⇄ Mover
      </button>
      <button
        onClick={() => onDelete(episode)}
        title="Deletar episódio (e todas as cenas dele)"
        style={{
          background: `${C.red}15`,
          border: `1px solid ${C.red}40`,
          borderRadius: 6,
          padding: '3px 8px',
          cursor: 'pointer',
          color: C.red,
          fontSize: 11,
          fontFamily: 'inherit',
        }}
      >
        × Deletar
      </button>
    </div>
  )
}
