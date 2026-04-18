'use client'
import React from 'react'
import { Handle, Position } from '@xyflow/react'

export function CharacterNode({ data, selected }: { data: Record<string, unknown>; selected: boolean }) {
  const name = (data.name as string) ?? (data.label as string) ?? 'Personagem'
  const sheetUrl = data.sheetUrl as string | undefined
  const emoji = (data.emoji as string) ?? '👤'
  const color = '#D4A0C8'

  return (
    <div style={{
      background: '#1a1730',
      border: `2px solid ${selected ? color : '#2A2545'}`,
      borderRadius: 10,
      overflow: 'hidden',
      width: 180,
      boxShadow: selected ? `0 0 16px ${color}30` : 'none',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: color, width: 8, height: 8 }} />
      <div style={{ aspectRatio: '1/1', background: '#0f0d1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {sheetUrl ? (
          <img src={sheetUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 48 }}>{emoji}</span>
        )}
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 14 }}>{emoji}</span>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#E8E5F0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </div>
        </div>
        <span style={{ fontSize: 9, color: color, flexShrink: 0, marginLeft: 4 }}>CHAR</span>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: color, width: 8, height: 8 }} />
    </div>
  )
}
