'use client'
import React from 'react'
import { Handle, Position } from '@xyflow/react'
import { useWorkflow } from '../WorkflowContext'
import { NodeShell } from '../components/NodeShell'
import { NodeHeader } from '../components/NodeHeader'
import { NodeActionsToolbar } from '../components/NodeActionsToolbar'
import { standardNodeActions } from '../components/nodeActions'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { NODE_TYPE_ICONS } from '../theme/icons'
import { wfColors } from '../theme/workflowTheme'

export function CharacterNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { duplicateNode, deleteNode } = useWorkflow()
  const name = (data.name as string) ?? (data.label as string) ?? 'Personagem'
  const sheetUrl = data.sheetUrl as string | undefined
  const accent = (data.color as string) || getNodeTypeMeta('character').color

  return (
    <NodeShell type="character" selected={selected} colorOverride={accent} width={180} flush>
      <NodeActionsToolbar actions={standardNodeActions(id, { duplicateNode, deleteNode })} />
      <Handle type="target" position={Position.Left} style={{ background: accent, width: 8, height: 8, marginTop: 24 }} />

      <div style={{ padding: '10px 12px 6px' }}>
        <NodeHeader type="character" accent={accent} label={name} />
      </div>

      <div style={{
        aspectRatio: '1/1', background: wfColors.surfaceDeep,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderTop: `1px solid ${wfColors.border}`,
      }}>
        {sheetUrl ? (
          <img src={sheetUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          (() => { const I = NODE_TYPE_ICONS.character; return <I size={36} color={wfColors.textFaint} strokeWidth={1.25} /> })()
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: accent, width: 8, height: 8, marginTop: 24 }} />
    </NodeShell>
  )
}
