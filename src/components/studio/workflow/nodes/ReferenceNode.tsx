'use client'
import React, { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useWorkflow } from '../WorkflowContext'

export function ReferenceNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { updateNode } = useWorkflow()
  const url = data.url as string | undefined
  const label = (data.label as string) ?? ''
  const color = '#AFA9EC'

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

  const displayUrl = url && url.length > 50 ? url.slice(0, 50) + '...' : url

  return (
    <div style={{
      background: '#1a1730',
      border: `2px solid ${selected ? color : '#2A2545'}`,
      borderRadius: 10,
      padding: '12px 14px',
      minWidth: 180,
      maxWidth: 260,
      boxShadow: selected ? `0 0 16px ${color}30` : 'none',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: color, width: 8, height: 8 }} />
      <div style={{ fontSize: 10, color: '#9F9AB8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>🔗</span> Referência
      </div>
      {editing ? (
        <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <input
            value={draftUrl}
            onChange={e => setDraftUrl(e.target.value)}
            placeholder="URL ou link"
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
            placeholder="Título"
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
        <div onDoubleClick={() => setEditing(true)} style={{ cursor: 'text' }}>
          {displayUrl && (
            <div style={{ fontSize: 11, color: color, wordBreak: 'break-all', marginBottom: 4 }}>
              {displayUrl}
            </div>
          )}
          <div style={{ fontSize: 12, color: '#E8E5F0', fontWeight: 600 }}>
            {label || <span style={{ color: '#6B6688', fontWeight: 400 }}>Double-click pra editar...</span>}
          </div>
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: color, width: 8, height: 8 }} />
    </div>
  )
}
