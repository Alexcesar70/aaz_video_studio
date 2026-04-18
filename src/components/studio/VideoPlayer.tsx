'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { C } from './theme'

export interface PlayerScene {
  id: string
  title: string
  subtitle?: string
  videoUrl: string
  duration: number
  thumbnailUrl?: string
  status?: 'ready' | 'generating' | 'pending' | 'error'
  progress?: number
}

interface SequentialPlayerProps {
  scenes: PlayerScene[]
  autoplay?: boolean
  onSceneChange?: (index: number) => void
  onOpenInEditor?: (scene: PlayerScene) => void
  showControls?: boolean
  compact?: boolean
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}

export function SequentialPlayer({
  scenes,
  autoplay = false,
  onSceneChange,
  onOpenInEditor,
  showControls = true,
  compact = false,
}: SequentialPlayerProps) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const activeScene = scenes[activeIdx]

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0)

  const goToScene = useCallback((idx: number) => {
    if (idx < 0 || idx >= scenes.length) return
    setActiveIdx(idx)
    onSceneChange?.(idx)
    if (videoRef.current) {
      videoRef.current.currentTime = 0
    }
  }, [scenes.length, onSceneChange])

  const handleVideoEnd = useCallback(() => {
    if (activeIdx < scenes.length - 1) {
      goToScene(activeIdx + 1)
    } else {
      setIsPlaying(false)
    }
  }, [activeIdx, scenes.length, goToScene])

  const togglePlay = useCallback(() => {
    if (!videoRef.current || !activeScene?.videoUrl) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play().catch(() => {})
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying, activeScene])

  useEffect(() => {
    if (autoplay && videoRef.current && activeScene?.videoUrl) {
      videoRef.current.play().catch(() => {})
      setIsPlaying(true)
    }
  }, [autoplay, activeScene])

  useEffect(() => {
    if (videoRef.current && activeScene?.videoUrl) {
      videoRef.current.load()
      if (isPlaying) {
        videoRef.current.play().catch(() => {})
      }
    }
  }, [activeIdx])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); togglePlay() }
      if (e.key === 'ArrowRight') goToScene(activeIdx + 1)
      if (e.key === 'ArrowLeft') goToScene(activeIdx - 1)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [togglePlay, goToScene, activeIdx])

  if (scenes.length === 0) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '60px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎬</div>
        <div style={{ fontSize: 14, color: C.textDim }}>Nenhuma cena pra exibir.</div>
      </div>
    )
  }

  const playerHeight = compact ? 300 : 480

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Player area */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: playerHeight,
        background: '#000',
        borderRadius: '12px 12px 0 0',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {activeScene?.videoUrl ? (
          <video
            ref={videoRef}
            src={activeScene.videoUrl}
            onEnded={handleVideoEnd}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            playsInline
          />
        ) : (
          <div style={{ textAlign: 'center', color: C.textDim }}>
            {activeScene?.status === 'generating' ? (
              <>
                <div style={{
                  width: 32, height: 32, margin: '0 auto 12px',
                  border: `3px solid ${C.border}`, borderTopColor: C.purple,
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                }} />
                <div style={{ fontSize: 12 }}>Gerando... {activeScene.progress ? `${Math.round(activeScene.progress * 100)}%` : ''}</div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </>
            ) : activeScene?.status === 'pending' ? (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
                <div style={{ fontSize: 12 }}>Cena pendente</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎬</div>
                <div style={{ fontSize: 12 }}>Sem vídeo</div>
              </>
            )}
          </div>
        )}

        {/* Overlay: scene info */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
          padding: '40px 16px 12px',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
              CENA {activeIdx + 1}/{scenes.length}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>
              {activeScene?.title}
            </div>
            {activeScene?.subtitle && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                {activeScene.subtitle}
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
            {activeScene?.duration}s · {formatTime(totalDuration)} total
          </div>
        </div>

        {/* Play/pause overlay button */}
        {activeScene?.videoUrl && (
          <button
            onClick={togglePlay}
            style={{
              position: 'absolute', inset: 0,
              background: 'transparent', border: 'none', cursor: 'pointer',
              display: isPlaying ? 'none' : 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 20,
            }}>
              ▶
            </div>
          </button>
        )}
      </div>

      {/* Controls bar */}
      {showControls && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px',
          background: C.surface,
          borderLeft: `1px solid ${C.border}`,
          borderRight: `1px solid ${C.border}`,
        }}>
          <button onClick={() => goToScene(activeIdx - 1)} disabled={activeIdx === 0}
            style={{ background: 'transparent', border: 'none', color: activeIdx === 0 ? C.textDim : C.text, cursor: activeIdx === 0 ? 'default' : 'pointer', fontSize: 14, padding: '4px 8px' }}>
            ⏮
          </button>
          <button onClick={togglePlay}
            style={{ background: 'transparent', border: 'none', color: C.text, cursor: 'pointer', fontSize: 16, padding: '4px 8px' }}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button onClick={() => goToScene(activeIdx + 1)} disabled={activeIdx === scenes.length - 1}
            style={{ background: 'transparent', border: 'none', color: activeIdx === scenes.length - 1 ? C.textDim : C.text, cursor: activeIdx === scenes.length - 1 ? 'default' : 'pointer', fontSize: 14, padding: '4px 8px' }}>
            ⏭
          </button>

          {/* Progress dots */}
          <div style={{ flex: 1, display: 'flex', gap: 3, alignItems: 'center', padding: '0 8px' }}>
            {scenes.map((s, i) => (
              <button key={s.id} onClick={() => goToScene(i)} style={{
                flex: s.duration,
                height: 4,
                borderRadius: 2,
                background: i === activeIdx ? C.purple : i < activeIdx ? `${C.purple}60` : C.border,
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'background 0.2s',
              }} title={`${s.title} (${s.duration}s)`} />
            ))}
          </div>

          <span style={{ fontSize: 11, color: C.textDim, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
            {formatTime(totalDuration)}
          </span>

          {onOpenInEditor && activeScene && (
            <button onClick={() => onOpenInEditor(activeScene)}
              style={{ background: `${C.purple}20`, border: `1px solid ${C.purple}40`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: C.purple, fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>
              Editar
            </button>
          )}
        </div>
      )}

      {/* Scene strip */}
      <div style={{
        display: 'flex', gap: 8, padding: '12px',
        background: C.card,
        borderRadius: '0 0 12px 12px',
        border: `1px solid ${C.border}`,
        borderTop: 'none',
        overflowX: 'auto',
      }}>
        {scenes.map((scene, i) => {
          const isActive = i === activeIdx
          const ready = scene.status === 'ready' || !!scene.videoUrl
          return (
            <button
              key={scene.id}
              onClick={() => goToScene(i)}
              style={{
                flexShrink: 0,
                width: compact ? 120 : 160,
                background: isActive ? `${C.purple}15` : C.surface,
                border: `2px solid ${isActive ? C.purple : C.border}`,
                borderRadius: 8,
                padding: 0,
                cursor: 'pointer',
                overflow: 'hidden',
                textAlign: 'left',
                fontFamily: 'inherit',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Thumbnail */}
              <div style={{
                width: '100%', aspectRatio: '16/9',
                background: ready
                  ? `linear-gradient(135deg, hsl(${(i * 60 + 200) % 360}, 40%, 30%), hsl(${(i * 60 + 230) % 360}, 30%, 15%))`
                  : C.card,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: C.textDim,
                position: 'relative', overflow: 'hidden',
              }}>
                {scene.thumbnailUrl ? (
                  <img src={scene.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : scene.videoUrl ? (
                  <video src={scene.videoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted preload="metadata" />
                ) : null}
                <div style={{
                  position: 'absolute', top: 4, left: 4,
                  padding: '1px 5px', borderRadius: 3,
                  background: 'rgba(0,0,0,0.7)', fontSize: 9,
                  color: '#fff', fontFamily: 'monospace',
                }}>#{i + 1}</div>
                {!ready && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.4)',
                    fontSize: 9, color: C.textDim, textTransform: 'uppercase', letterSpacing: 1,
                  }}>
                    {scene.status === 'generating' ? `${Math.round((scene.progress ?? 0) * 100)}%` : scene.status ?? 'pendente'}
                  </div>
                )}
              </div>
              {/* Info */}
              <div style={{ padding: '6px 8px' }}>
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  color: isActive ? C.text : C.textDim,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{scene.title}</div>
                <div style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>{scene.duration}s</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
