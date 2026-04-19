'use client'
import React from 'react'
import { Handle, Position } from '@xyflow/react'
import { useWorkflow } from '../WorkflowContext'
import { NodeShell } from '../components/NodeShell'
import { NodeHeader } from '../components/NodeHeader'
import { NodeActionsToolbar } from '../components/NodeActionsToolbar'
import { standardNodeActions } from '../components/nodeActions'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { wfColors } from '../theme/workflowTheme'

export function ScenarioNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { duplicateNode, deleteNode } = useWorkflow()
  const name = (data.name as string) ?? (data.label as string) ?? 'Cenário'
  const imageUrl = data.imageUrl as string | undefined
  const accent = (data.color as string) || getNodeTypeMeta('scenario').color

  return (
    <NodeShell type="scenario" selected={selected} colorOverride={accent} width={220} flush>
      <NodeActionsToolbar actions={standardNodeActions(id, { duplicateNode, deleteNode })} />
      <Handle type="target" position={Position.Left} style={{ background: accent, width: 8, height: 8, marginTop: 24 }} />

      <div style={{ padding: '10px 12px 6px' }}>
        <NodeHeader type="scenario" accent={accent} label={name} />
      </div>

      <div style={{
        aspectRatio: '16/9', background: wfColors.surfaceDeep,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderTop: `1px solid ${wfColors.border}`,
      }}>
        {imageUrl ? (
          <img src={imageUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 28, opacity: 0.4 }}>🏞</span>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: accent, width: 8, height: 8, marginTop: 24 }} />
    </NodeShell>
  )
}
