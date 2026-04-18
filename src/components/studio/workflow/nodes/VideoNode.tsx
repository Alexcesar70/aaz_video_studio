'use client'
import React from 'react'
import { Handle, Position } from '@xyflow/react'

export function VideoNode({ data, selected }: { data: Record<string, unknown>; selected: boolean }) {
  const url = data.url as string | undefined
  const label = (data.label as string) ?? 'Vídeo'
  const duration = data.duration as number | undefined
  const color = '#5DCAA5'

  return (
    <div style={{
      background: '#1a1730',
      border: `2px solid ${selected ? color : '#2A2545'}`,
      borderRadius: 10,
      overflow: 'hidden',
      width: 200,
      boxShadow: selected ? `0 0 16px ${color}30` : 'none',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: color, width: 8, height: 8 }} />
      <div style={{ aspectRatio: '16/9', background: '#0f0d1a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {url ? (
          <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted preload="metadata" />
        ) : (
          <span style={{ fontSize: 32 }}>🎬</span>
        )}
        {duration && (
          <span style={{
            position: 'absolute', bottom: 4, right: 4,
            padding: '1px 5px', borderRadius: 3,
            background: 'rgba(0,0,0,0.7)', fontSize: 9,
            color: '#fff', fontFamily: 'monospace',
          }}>{duration}s</span>
        )}
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#E8E5F0' }}>{label}</div>
        <span style={{ fontSize: 9, color: color }}>▶</span>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: color, width: 8, height: 8 }} />
    </div>
  )
}
