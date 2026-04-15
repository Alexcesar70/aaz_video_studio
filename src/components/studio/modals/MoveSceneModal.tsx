'use client'

/**
 * MoveSceneModal — modal pra mover uma cena entre projetos/episódios.
 * Extraído de AAZStudio.tsx (M2-PR7).
 */

import React, { useState, useEffect } from 'react'
import { C } from '../theme'
import type { Project, Episode, SceneAsset } from '../types'

interface Props {
  scene: SceneAsset
  projects: Project[]
  episodes: Episode[]
  onClose: () => void
  onConfirm: (episodeId: string | null, projectId: string | null) => void | Promise<void>
}

export function MoveSceneModal({
  scene,
  projects,
  episodes,
  onClose,
  onConfirm,
}: Props) {
  const [projId, setProjId] = useState<string>(scene.projectId ?? '')
  const [epId, setEpId] = useState<string>(scene.episodeId ?? '')

  // Filtra episódios pelo projeto selecionado
  const availableEps = projId
    ? episodes.filter((e) => e.projectId === projId)
    : episodes.filter((e) => !e.projectId)

  // Se trocar de projeto, reset do episódio
  useEffect(() => {
    if (epId && !availableEps.some((e) => e.id === epId)) setEpId('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projId])

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
            Mover cena
          </h2>
          <div
            style={{
              fontSize: 12,
              color: C.textDim,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {scene.prompt}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>Projeto</div>
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
            <option value="">— Sem projeto —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                📁 {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>Episódio</div>
          <select
            value={epId}
            onChange={(e) => setEpId(e.target.value)}
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
            <option value="">— Sem episódio (órfã) —</option>
            {availableEps.map((ep) => (
              <option key={ep.id} value={ep.id}>
                🎬 {ep.name?.trim() || '(sem nome)'}
              </option>
            ))}
          </select>
          {projId && availableEps.length === 0 && (
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>
              Nenhum episódio neste projeto. A cena vai para o projeto sem episódio.
            </div>
          )}
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
            onClick={() => onConfirm(epId || null, projId || null)}
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
