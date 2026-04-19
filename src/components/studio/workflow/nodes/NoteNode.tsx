'use client'
import React, { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useWorkflow } from '../WorkflowContext'
import { NodeShell } from '../components/NodeShell'
import { NodeHeader } from '../components/NodeHeader'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { wfColors, wfRadius } from '../theme/workflowTheme'

export function NoteNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { updateNode } = useWorkflow()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState((data.text as string) ?? '')
  const accent = (data.color as string) || getNodeTypeMeta('note').color

  const handleBlur = () => {
    setEditing(false)
    if (text !== (data.text ?? '')) {
      updateNode(id, { content: { text } })
    }
  }

  return (
    <NodeShell type="note" selected={selected} colorOverride={accent} minWidth={180} maxWidth={280}>
      <Handle type="target" position={Position.Left} style={{ background: accent, width: 8, height: 8 }} />
      <NodeHeader type="note" accent={accent} />

      {editing ? (
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={handleBlur}
          autoFocus
          className="nodrag"
          style={{
            width: '100%', minHeight: 60, padding: 6, borderRadius: wfRadius.inner,
            background: wfColors.surfaceDeep, border: `1px solid ${wfColors.border}`,
            color: wfColors.text, fontSize: 12, fontFamily: 'inherit',
            resize: 'vertical', outline: 'none',
          }}
        />
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          style={{ fontSize: 12, color: wfColors.text, lineHeight: 1.5, cursor: 'text', minHeight: 30, whiteSpace: 'pre-wrap' }}
        >
          {text || <span style={{ color: wfColors.textFaint }}>Double-click pra editar...</span>}
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: accent, width: 8, height: 8 }} />
    </NodeShell>
  )
}
