'use client'

/**
 * SceneCard — card visual de uma cena no histórico.
 * Extraído de AAZStudio.tsx (M5-PR6).
 */

import React from 'react'
import { C } from '../theme'
import { Pill } from '../atoms'
import type { SceneAsset, SceneStatus } from '../types'

interface Props {
  scene: SceneAsset
  onPlay: (s: SceneAsset) => void
  onDownload: (url: string, filename: string) => void
  onDelete: (id: string) => void
  onMoveScene: (s: SceneAsset) => void
  onSetStatus: (sceneId: string, status: SceneStatus) => void
}

export function SceneCard({
  scene,
  onPlay,
  onDownload,
  onDelete,
  onMoveScene,
  onSetStatus,
}: Props) {
  const d = new Date(scene.createdAt)
  const dateStr =
    d.toLocaleDateString('pt-BR') +
    ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const status = scene.status ?? 'draft'
  const statusColor =
    status === 'approved' ? C.green : status === 'rejected' ? C.red : C.gold
  const statusLabel =
    status === 'approved'
      ? 'Aprovada'
      : status === 'rejected'
        ? 'Rejeitada'
        : 'Rascunho'
  const cardOpacity = status === 'rejected' ? 0.55 : 1

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${status === 'approved' ? `${C.green}60` : C.border}`,
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        opacity: cardOpacity,
        transition: 'opacity 0.2s',
      }}
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: '16/9',
          background: '#000',
          cursor: 'pointer',
        }}
        onClick={() => onPlay(scene)}
      >
        <video
          src={scene.videoUrl}
          muted
          playsInline
          preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onMouseEnter={(e) =>
            (e.currentTarget as HTMLVideoElement).play().catch(() => {})
          }
          onMouseLeave={(e) => {
            const v = e.currentTarget as HTMLVideoElement
            v.pause()
            v.currentTime = 0
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.25)',
            opacity: 0.9,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(167,139,250,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              color: '#fff',
            }}
          >
            ▶
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(0,0,0,0.6)',
            borderRadius: 20,
            padding: '3px 9px',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: statusColor,
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#fff',
              letterSpacing: '0.3px',
            }}
          >
            {statusLabel}
          </span>
        </div>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(scene.title || scene.sceneNumber > 0) && (
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>
            {scene.sceneNumber > 0 && (
              <span style={{ color: C.purple }}>#{scene.sceneNumber}</span>
            )}
            {scene.title && (
              <span style={{ marginLeft: scene.sceneNumber > 0 ? 6 : 0 }}>
                — {scene.title}
              </span>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Pill color={C.blue}>{scene.duration}s</Pill>
          <Pill color={C.green}>${scene.cost}</Pill>
        </div>
        <div
          title={scene.prompt}
          style={{
            fontSize: 12,
            color: C.textDim,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {scene.prompt}
        </div>
        <div style={{ fontSize: 11, color: C.textDim }}>{dateStr}</div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() =>
              onSetStatus(scene.id, status === 'approved' ? 'draft' : 'approved')
            }
            title={
              status === 'approved'
                ? 'Clique para voltar a rascunho'
                : 'Marcar como aprovada'
            }
            style={{
              flex: 1,
              background: status === 'approved' ? C.green : `${C.green}15`,
              border: `1px solid ${status === 'approved' ? C.green : `${C.green}40`}`,
              borderRadius: 8,
              padding: '6px',
              cursor: 'pointer',
              color: status === 'approved' ? '#fff' : C.green,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            ✓ Aprovar
          </button>
          <button
            onClick={() =>
              onSetStatus(scene.id, status === 'rejected' ? 'draft' : 'rejected')
            }
            title={
              status === 'rejected'
                ? 'Clique para voltar a rascunho'
                : 'Marcar como rejeitada (some dos players)'
            }
            style={{
              flex: 1,
              background: status === 'rejected' ? C.red : `${C.red}15`,
              border: `1px solid ${status === 'rejected' ? C.red : `${C.red}40`}`,
              borderRadius: 8,
              padding: '6px',
              cursor: 'pointer',
              color: status === 'rejected' ? '#fff' : C.red,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            ⊘ Rejeitar
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => onPlay(scene)}
            style={{
              flex: 1,
              background: C.purpleGlow,
              border: `1px solid ${C.purple}50`,
              borderRadius: 8,
              padding: '7px',
              cursor: 'pointer',
              color: C.purple,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            ▶ Assistir
          </button>
          <button
            onClick={() => onMoveScene(scene)}
            title="Mover para outro episódio/projeto"
            style={{
              background: `${C.gold}15`,
              border: `1px solid ${C.gold}40`,
              borderRadius: 8,
              padding: '7px 10px',
              cursor: 'pointer',
              color: C.gold,
              fontSize: 12,
              fontFamily: 'inherit',
            }}
          >
            ⇄
          </button>
          <button
            onClick={() => onDownload(scene.videoUrl, `aaz-${scene.id}.mp4`)}
            title="Baixar MP4"
            style={{
              background: C.blueGlow,
              border: `1px solid ${C.blue}40`,
              borderRadius: 8,
              padding: '7px 10px',
              cursor: 'pointer',
              color: C.blue,
              fontSize: 12,
              fontFamily: 'inherit',
            }}
          >
            ↓
          </button>
          <button
            onClick={() => onDelete(scene.id)}
            title="Remover do histórico"
            style={{
              background: `${C.red}15`,
              border: `1px solid ${C.red}40`,
              borderRadius: 8,
              padding: '7px 10px',
              cursor: 'pointer',
              color: C.red,
              fontSize: 12,
              fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
