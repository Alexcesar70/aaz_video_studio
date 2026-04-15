'use client'

/**
 * EpisodeDeliveryCard — bloco de entrega final do episódio
 * (upload do MP4 do CapCut/Premiere para revisão do admin).
 *
 * Extraído de AAZStudio.tsx (M5-PR6).
 */

import React from 'react'
import { C } from '../theme'
import type { Episode } from '../types'

interface Props {
  episode: Episode
  onOpen: (e: Episode) => void
}

export function EpisodeDeliveryCard({ episode, onOpen }: Props) {
  const status = episode.finalStatus ?? 'none'
  const hasDelivery = !!episode.finalVideoUrl
  const statusColor =
    status === 'approved'
      ? C.green
      : status === 'needs_changes'
        ? C.gold
        : status === 'pending_review'
          ? C.purple
          : C.textDim
  const statusLabel =
    status === 'approved'
      ? '✓ Aprovado'
      : status === 'needs_changes'
        ? '🟠 Precisa ajustes'
        : status === 'pending_review'
          ? '🟡 Aguardando revisão'
          : 'Sem entrega'
  const uploadedWhen = episode.finalVideoUploadedAt
    ? new Date(episode.finalVideoUploadedAt).toLocaleDateString('pt-BR') +
      ' ' +
      new Date(episode.finalVideoUploadedAt).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  return (
    <div
      style={{
        background: hasDelivery ? `${statusColor}10` : C.card,
        border: `1px solid ${hasDelivery ? statusColor + '60' : C.border}`,
        borderRadius: 10,
        padding: '14px 16px',
        marginTop: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
      }}
    >
      {hasDelivery && episode.finalVideoUrl ? (
        <video
          src={episode.finalVideoUrl}
          muted
          playsInline
          preload="metadata"
          style={{
            width: 80,
            height: 48,
            borderRadius: 6,
            objectFit: 'cover',
            background: '#000',
            border: `1px solid ${statusColor}40`,
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 80,
            height: 48,
            borderRadius: 6,
            background: C.card,
            border: `1px dashed ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          📹
        </div>
      )}

      <div style={{ flex: 1, minWidth: 180 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.textDim,
            letterSpacing: '0.5px',
            marginBottom: 2,
          }}
        >
          ENTREGA FINAL
        </div>
        {hasDelivery ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: statusColor }}>
              {statusLabel}
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
              {episode.finalVideoSizeMB
                ? `${episode.finalVideoSizeMB} MB · `
                : ''}
              Enviado {uploadedWhen}
            </div>
            {episode.reviewNote && (
              <div
                style={{
                  fontSize: 11,
                  color: C.text,
                  marginTop: 6,
                  fontStyle: 'italic',
                  background: C.card,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: `1px solid ${statusColor}30`,
                  maxWidth: 500,
                }}
              >
                <strong style={{ color: statusColor }}>Admin:</strong> &quot;
                {episode.reviewNote}&quot;
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 12, color: C.textDim }}>
            Depois de montar o episódio no CapCut/Premiere, envie o MP4 final
            pra revisão do admin.
          </div>
        )}
      </div>

      <button
        onClick={() => onOpen(episode)}
        style={{
          background: hasDelivery ? 'transparent' : C.purple,
          border: `1px solid ${hasDelivery ? C.border : C.purple}`,
          borderRadius: 8,
          padding: '9px 16px',
          cursor: 'pointer',
          color: hasDelivery ? C.text : '#fff',
          fontSize: 12,
          fontWeight: 700,
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
        }}
      >
        {hasDelivery ? '📤 Reenviar / ver' : '📤 Enviar episódio final'}
      </button>
    </div>
  )
}
