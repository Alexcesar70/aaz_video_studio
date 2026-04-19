'use client'
import React, { useState } from 'react'
import { useWorkflow } from '../WorkflowContext'
import { NodeShell } from '../components/NodeShell'
import { NodeHeader } from '../components/NodeHeader'
import { NodeFrame } from '../components/NodeFrame'
import { standardNodeActions, openLinkAction } from '../components/nodeActions'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { ActionIcons, DEFAULT_ICON_PROPS } from '../theme/icons'
import { wfColors, wfRadius } from '../theme/workflowTheme'
import type { NodeAction } from '../components/NodeActionsToolbar'

export function ReferenceNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { updateNode, duplicateNode, deleteNode } = useWorkflow()
  const url = data.url as string | undefined
  const label = (data.label as string) ?? ''
  const accent = (data.color as string) || getNodeTypeMeta('reference').color

  const [editing, setEditing] = useState(false)
  const [draftUrl, setDraftUrl] = useState(url ?? '')
  const [draftLabel, setDraftLabel] = useState(label)

  const openAction = openLinkAction(url)
  const actions: NodeAction[] = [
    {
      id: 'edit-url',
      icon: <ActionIcons.editUrl size={9} {...DEFAULT_ICON_PROPS} />,
      title: 'Editar URL',
      onClick: () => setEditing(true),
    },
    ...(openAction ? [openAction] : []),
    ...standardNodeActions(id, { duplicateNode, deleteNode }),
  ]

  const save = () => {
    setEditing(false)
    const patch: { content?: Record<string, unknown>; label?: string } = {}
    if (draftUrl !== (url ?? '')) patch.content = { url: draftUrl || undefined }
    if (draftLabel !== label) patch.label = draftLabel
    if (patch.content || patch.label !== undefined) updateNode(id, patch)
  }

  const displayUrl = url && url.length > 50 ? url.slice(0, 50) + '...' : url

  return (
    <NodeFrame
      outputs={[{ dataType: 'any' }]}
      actions={actions}
    >
      <NodeShell type="reference" selected={selected} colorOverride={accent} minWidth={200} maxWidth={280}>
        <NodeHeader type="reference" accent={accent} />

        {editing ? (
          <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              value={draftUrl}
              onChange={e => setDraftUrl(e.target.value)}
              placeholder="URL ou link"
              autoFocus
              style={inputStyle}
            />
            <input
              value={draftLabel}
              onChange={e => setDraftLabel(e.target.value)}
              placeholder="Título"
              onBlur={save}
              onKeyDown={e => { if (e.key === 'Enter') save() }}
              style={inputStyle}
            />
          </div>
        ) : (
          <div onDoubleClick={() => setEditing(true)} style={{ cursor: 'text' }}>
            {displayUrl && (
              <div style={{ fontSize: 11, color: accent, wordBreak: 'break-all', marginBottom: 4 }}>
                {displayUrl}
              </div>
            )}
            <div style={{ fontSize: 12, color: wfColors.text, fontWeight: 600 }}>
              {label || <span style={{ color: wfColors.textFaint, fontWeight: 400 }}>Double-click pra editar...</span>}
            </div>
          </div>
        )}
      </NodeShell>
    </NodeFrame>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '5px 7px', borderRadius: wfRadius.control,
  background: wfColors.surfaceDeep, border: `1px solid ${wfColors.border}`,
  color: wfColors.text, fontSize: 11, fontFamily: 'inherit', outline: 'none',
}
