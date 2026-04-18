'use client'
import React from 'react'
import { Handle, Position } from '@xyflow/react'

export function ReferenceNode({ data, selected }: { data: Record<string, unknown>; selected: boolean }) {
  const url = data.url as string | undefined
  const label = (data.label as string) ?? 'Referência'
  const color = '#AFA9EC'

  return (
    <div style={{
      background: '#1a1730',
      border: `2px solid ${selected ? color : '#2A2545'}`,
      borderRadius: 10,
      padding: '12px 14px',
      minWidth: 180,
      maxWidth: 250,
      boxShadow: selected ? `0 0 16px ${color}30` : 'none',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: color, width: 8, height: 8 }} />
      <div style={{ fontSize: 10, color: '#9F9AB8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>🔗</span> Referência
      </div>
      {url && (
        <div style={{ fontSize: 11, color: color, wordBreak: 'break-all', marginBottom: 4 }}>
          {url.length > 50 ? url.slice(0, 50) + '...' : url}
        </div>
      )}
      <div style={{ fontSize: 12, color: '#E8E5F0', fontWeight: 600 }}>{label}</div>
      <Handle type="source" position={Position.Right} style={{ background: color, width: 8, height: 8 }} />
    </div>
  )
}
