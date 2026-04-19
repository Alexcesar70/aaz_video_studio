'use client'
import React from 'react'
import { useWorkflow } from '../WorkflowContext'
import { NodeShell } from '../components/NodeShell'
import { NodeHeader } from '../components/NodeHeader'
import { NodeFrame } from '../components/NodeFrame'
import { standardNodeActions } from '../components/nodeActions'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { NODE_TYPE_ICONS } from '../theme/icons'
import { wfColors } from '../theme/workflowTheme'

export function ScenarioNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { duplicateNode, deleteNode } = useWorkflow()
  const name = (data.name as string) ?? (data.label as string) ?? 'Cenário'
  const imageUrl = data.imageUrl as string | undefined
  const accent = (data.color as string) || getNodeTypeMeta('scenario').color

  return (
    <NodeFrame
      outputs={[{ dataType: 'image' }]}
      actions={standardNodeActions(id, { duplicateNode, deleteNode })}
    >
      <NodeShell type="scenario" selected={selected} colorOverride={accent} width={220} flush>
        <div style={{ padding: '10px 12px 6px' }}>
          <NodeHeader type="scenario" accent={accent} label={name} />
        </div>

        <div style={{
          aspectRatio: '16/9', background: wfColors.surfaceDeep,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderTop: `1px solid ${wfColors.border}`,
          overflow: 'hidden',
        }}>
          {imageUrl ? (
            <img src={imageUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            (() => { const I = NODE_TYPE_ICONS.scenario; return <I size={28} color={wfColors.textFaint} strokeWidth={1.25} /> })()
          )}
        </div>
      </NodeShell>
    </NodeFrame>
  )
}
