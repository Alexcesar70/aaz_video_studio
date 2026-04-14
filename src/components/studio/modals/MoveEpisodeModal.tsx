'use client'

/**
 * MoveEpisodeModal — modal pra mover um episódio entre projetos.
 * Extraído de AAZStudio.tsx (M2-PR7).
 */

import React, { useState } from 'react'
import { C } from '../theme'
import type { Project, Episode } from '../types'

interface Props {
  episode: Episode
  projects: Project[]
  onClose: () => void
  onConfirm: (projectId: string | null) => void | Promise<void>
}

export function MoveEpisodeModal({ episode, projects, onClose, onConfirm }: Props) {
  const [projId, setProjId] = useState<string>(episode.projectId ?? '')

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: 24,
          width: '100%',
          maxWidth: 440,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0, marginBottom: 4 }}>
            Mover episódio
          </h2>
          <div style={{ fontSize: 13, color: C.textDim }}>
            🎬 {episode.name?.trim() || '(sem nome)'}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>
            Projeto de destino
          </div>
          <select
            value={projId}
            onChange={(e) => setProjId(e.target.value)}
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '10px 14px',
              color: C.text,
              fontSize: 14,
              outline: 'none',
              fontFamily: 'inherit',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <option value="">— Sem projeto (avulso) —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                📁 {p.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '10px 18px',
              cursor: 'pointer',
              color: C.textDim,
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(projId || null)}
            style={{
              background: C.purple,
              border: `1px solid ${C.purple}`,
              borderRadius: 10,
              padding: '10px 20px',
              cursor: 'pointer',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            Mover
          </button>
        </div>
      </div>
    </div>
  )
}
