'use client'
import React, { useState } from 'react'
import { useWorkflow } from '../WorkflowContext'
import { NodeShell } from '../components/NodeShell'
import { NodeHeader } from '../components/NodeHeader'
import { NodeFrame } from '../components/NodeFrame'
import { standardNodeActions } from '../components/nodeActions'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { wfColors, wfRadius } from '../theme/workflowTheme'

export function NoteNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { updateNode, duplicateNode, deleteNode } = useWorkflow()
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
    <NodeFrame
      inputs={[{ dataType: 'text' }]}
      outputs={[{ dataType: 'text' }]}
      actions={standardNodeActions(id, { duplicateNode, deleteNode })}
    >
      <NodeShell type="note" selected={selected} colorOverride={accent} width={300}>
        <NodeHeader type="note" accent={accent} />

        {editing ? (
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={handleBlur}
            autoFocus
            className="nodrag"
            style={{
              width: '100%', minHeight: 150, padding: 12, borderRadius: wfRadius.inner,
              background: wfColors.surfaceDeep, border: `1px solid ${wfColors.border}`,
              color: wfColors.text, fontSize: 14, fontFamily: 'inherit',
              resize: 'vertical', outline: 'none',
              lineHeight: 1.55,
            }}
          />
        ) : (
          <div
            onDoubleClick={() => setEditing(true)}
            style={{
              fontSize: 14, color: wfColors.text, lineHeight: 1.55,
              cursor: 'text', minHeight: 130, whiteSpace: 'pre-wrap',
              padding: 12, borderRadius: wfRadius.inner,
              background: wfColors.surfaceDeep,
              border: `1px solid ${wfColors.border}`,
            }}
          >
            {text || <span style={{ color: wfColors.textFaint }}>Double-click pra editar...</span>}
          </div>
        )}
      </NodeShell>
    </NodeFrame>
  )
}
