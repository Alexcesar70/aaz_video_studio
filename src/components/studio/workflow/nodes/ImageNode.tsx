'use client'
import React, { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useWorkflow } from '../WorkflowContext'

export function ImageNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { updateNode } = useWorkflow()
  const url = data.url as string | undefined
  const label = (data.label as string) ?? ''
  const color = '#E5B87A'

  const [editing, setEditing] = useState(false)
  const [draftUrl, setDraftUrl] = useState(url ?? '')
  const [draftLabel, setDraftLabel] = useState(label)

  const save = () => {
    setEditing(false)
    const patch: { content?: Record<string, unknown>; label?: string } = {}
    if (draftUrl !== (url ?? '')) patch.content = { url: draftUrl || undefined }
    if (draftLabel !== label) patch.label = draftLabel
    if (patch.content || patch.label !== undefined) updateNode(id, patch)
  }

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
      <div
        onDoubleClick={() => setEditing(true)}
        style={{ aspectRatio: '16/9', background: '#0f0d1a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      >
        {url ? (
          <img src={url} alt={label || 'Imagem'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 32 }}>🖼️</span>
        )}
      </div>
      {editing ? (
        <div className="nodrag" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <input
            value={draftUrl}
            onChange={e => setDraftUrl(e.target.value)}
            placeholder="URL da imagem"
            autoFocus
            style={{
              width: '100%', padding: '4px 6px', borderRadius: 4,
              background: '#0f0d1a', border: '1px solid #2A2545',
              color: '#E8E5F0', fontSize: 10, fontFamily: 'inherit', outline: 'none',
            }}
          />
          <input
            value={draftLabel}
            onChange={e => setDraftLabel(e.target.value)}
            placeholder="Legenda"
            onBlur={save}
            onKeyDown={e => { if (e.key === 'Enter') save() }}
            style={{
              width: '100%', padding: '4px 6px', borderRadius: 4,
              background: '#0f0d1a', border: '1px solid #2A2545',
              color: '#E8E5F0', fontSize: 11, fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'text' }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: '#E8E5F0' }}>{label || 'Imagem'}</div>
          <span style={{ fontSize: 9, color: '#9F9AB8' }}>IMG</span>
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: color, width: 8, height: 8 }} />
    </div>
  )
}
