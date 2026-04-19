'use client'
import React, { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useWorkflow } from '../WorkflowContext'
import { NodeShell } from '../components/NodeShell'
import { NodeHeader } from '../components/NodeHeader'
import { NodeActionsToolbar, type NodeAction } from '../components/NodeActionsToolbar'
import { standardNodeActions, downloadAction } from '../components/nodeActions'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { ActionIcons, NODE_TYPE_ICONS, DEFAULT_ICON_PROPS } from '../theme/icons'
import { wfColors, wfRadius } from '../theme/workflowTheme'

export function VideoNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { updateNode, duplicateNode, deleteNode } = useWorkflow()
  const url = data.url as string | undefined
  const label = (data.label as string) ?? ''
  const duration = data.duration as number | undefined
  const accent = (data.color as string) || getNodeTypeMeta('video').color

  const [editing, setEditing] = useState(false)
  const [draftUrl, setDraftUrl] = useState(url ?? '')
  const [draftLabel, setDraftLabel] = useState(label)

  const actions: NodeAction[] = [
    {
      id: 'edit-url',
      icon: <ActionIcons.editUrl size={14} {...DEFAULT_ICON_PROPS} />,
      title: 'Editar URL',
      onClick: () => setEditing(true),
    },
    ...(downloadAction(url, `${label || 'video'}.mp4`) ? [downloadAction(url, `${label || 'video'}.mp4`)!] : []),
    ...standardNodeActions(id, { duplicateNode, deleteNode }),
  ]

  const save = () => {
    setEditing(false)
    const patch: { content?: Record<string, unknown>; label?: string } = {}
    if (draftUrl !== (url ?? '')) patch.content = { url: draftUrl || undefined }
    if (draftLabel !== label) patch.label = draftLabel
    if (patch.content || patch.label !== undefined) updateNode(id, patch)
  }

  return (
    <NodeShell type="video" selected={selected} colorOverride={accent} width={220} flush>
      <NodeActionsToolbar actions={actions} />
      <Handle type="target" position={Position.Left} style={{ background: accent, width: 8, height: 8, marginTop: 24 }} />

      <div style={{ padding: '10px 12px 6px' }}>
        <NodeHeader
          type="video"
          accent={accent}
          label={label || undefined}
          right={duration !== undefined ? (
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: wfColors.textDim }}>{duration}s</span>
          ) : undefined}
        />
      </div>

      <div
        onDoubleClick={() => setEditing(true)}
        style={{
          aspectRatio: '16/9', background: wfColors.surfaceDeep,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative',
          borderTop: `1px solid ${wfColors.border}`,
          borderBottom: `1px solid ${wfColors.border}`,
        }}
      >
        {url ? (
          <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted preload="metadata" />
        ) : (
          (() => { const I = NODE_TYPE_ICONS.video; return <I size={28} color={wfColors.textFaint} strokeWidth={1.25} /> })()
        )}
      </div>

      {editing ? (
        <div className="nodrag" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            value={draftUrl}
            onChange={e => setDraftUrl(e.target.value)}
            placeholder="URL do vídeo"
            autoFocus
            style={inputStyle}
          />
          <input
            value={draftLabel}
            onChange={e => setDraftLabel(e.target.value)}
            placeholder="Legenda"
            onBlur={save}
            onKeyDown={e => { if (e.key === 'Enter') save() }}
            style={inputStyle}
          />
        </div>
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          style={{ padding: '8px 12px', fontSize: 11, color: wfColors.textDim, cursor: 'text' }}
        >
          {label || <span style={{ color: wfColors.textFaint }}>Double-click pra editar</span>}
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: accent, width: 8, height: 8, marginTop: 24 }} />
    </NodeShell>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '5px 7px', borderRadius: wfRadius.control,
  background: wfColors.surfaceDeep, border: `1px solid ${wfColors.border}`,
  color: wfColors.text, fontSize: 11, fontFamily: 'inherit', outline: 'none',
}
