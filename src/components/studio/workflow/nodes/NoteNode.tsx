'use client'
import React, { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useWorkflow } from '../WorkflowContext'

export function NoteNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { updateNode } = useWorkflow()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState((data.text as string) ?? '')
  const color = (data.color as string) ?? '#7F77DD'

  const handleBlur = () => {
    setEditing(false)
    if (text !== (data.text ?? '')) {
      updateNode(id, { content: { text } })
    }
  }

  return (
    <div style={{
      background: '#1a1730',
      border: `2px solid ${selected ? color : '#2A2545'}`,
      borderRadius: 10,
      padding: '12px 14px',
      minWidth: 180,
      maxWidth: 280,
      boxShadow: selected ? `0 0 16px ${color}30` : 'none',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: color, width: 8, height: 8 }} />
      <div style={{ fontSize: 10, color: '#9F9AB8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>📝</span> Nota
      </div>
      {editing ? (
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={handleBlur}
          autoFocus
          className="nodrag"
          style={{
            width: '100%', minHeight: 60, padding: 6, borderRadius: 6,
            background: '#0f0d1a', border: '1px solid #2A2545',
            color: '#E8E5F0', fontSize: 12, fontFamily: 'inherit',
            resize: 'vertical', outline: 'none',
          }}
        />
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          style={{ fontSize: 12, color: '#E8E5F0', lineHeight: 1.5, cursor: 'text', minHeight: 30, whiteSpace: 'pre-wrap' }}
        >
          {text || <span style={{ color: '#6B6688' }}>Double-click pra editar...</span>}
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: color, width: 8, height: 8 }} />
    </div>
  )
}
