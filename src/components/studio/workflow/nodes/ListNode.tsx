'use client'
import React, { useCallback, useMemo, useState } from 'react'
import { useWorkflow } from '../WorkflowContext'
import { NodeShell } from '../components/NodeShell'
import { NodeHeader } from '../components/NodeHeader'
import { NodeFrame } from '../components/NodeFrame'
import { standardNodeActions } from '../components/nodeActions'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { wfColors, wfRadius } from '../theme/workflowTheme'

/**
 * List Node — coleção de itens (um por linha). Base pra scaling:
 * ligação futura com Image/Video Generator executa N vezes (um por
 * item). Por enquanto só edita e expõe o texto concatenado.
 *
 * data:
 *   items: string[]   — persistido, fonte de verdade
 *   text: string      — derivado (join '\n'), alimenta consumidores
 *                       downstream que só sabem ler 'text' hoje
 */

export function ListNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { updateNode, duplicateNode, deleteNode } = useWorkflow()
  const accent = (data.color as string) || getNodeTypeMeta('list').color

  const persistedItems = (data.items as string[] | undefined) ?? []
  const [rawText, setRawText] = useState(persistedItems.join('\n'))
  const [editing, setEditing] = useState(persistedItems.length === 0)

  const itemCount = useMemo(() => {
    return rawText.split('\n').map(s => s.trim()).filter(Boolean).length
  }, [rawText])

  const commit = useCallback(() => {
    setEditing(false)
    const items = rawText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
    const joined = items.join('\n')
    if (JSON.stringify(items) !== JSON.stringify(persistedItems)) {
      updateNode(id, { content: { items, text: joined } })
    }
  }, [id, rawText, persistedItems, updateNode])

  const actions = useMemo(
    () => standardNodeActions(id, { duplicateNode, deleteNode }),
    [id, duplicateNode, deleteNode],
  )

  return (
    <NodeFrame
      outputs={[{ dataType: 'text' }]}
      actions={actions}
    >
      <NodeShell
        type="list"
        selected={selected}
        colorOverride={accent}
        width={300}
      >
        <NodeHeader
          type="list"
          accent={accent}
          right={<span style={{ fontSize: 10, color: wfColors.textDim }}>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>}
        />

        {editing ? (
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            onBlur={commit}
            autoFocus
            placeholder="um item por linha…"
            className="nodrag"
            style={{
              width: '100%', minHeight: 140, padding: 10, borderRadius: wfRadius.inner,
              background: wfColors.surfaceDeep, border: `1px solid ${wfColors.border}`,
              color: wfColors.text, fontSize: 13, fontFamily: 'inherit',
              resize: 'vertical', outline: 'none',
              lineHeight: 1.5,
            }}
          />
        ) : (
          <div
            onDoubleClick={() => setEditing(true)}
            style={{
              padding: 10, borderRadius: wfRadius.inner,
              background: wfColors.surfaceDeep, border: `1px solid ${wfColors.border}`,
              minHeight: 120, maxHeight: 260, overflowY: 'auto', cursor: 'text',
            }}
          >
            {persistedItems.length > 0 ? (
              <ol style={{ margin: 0, paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {persistedItems.map((item, i) => (
                  <li key={i} style={{ color: wfColors.text, fontSize: 13, lineHeight: 1.5 }}>
                    {item}
                  </li>
                ))}
              </ol>
            ) : (
              <span style={{ fontSize: 13, color: wfColors.textFaint }}>Double-click pra adicionar itens…</span>
            )}
          </div>
        )}
      </NodeShell>
    </NodeFrame>
  )
}
