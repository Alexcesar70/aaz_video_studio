'use client'
import React, { useCallback, useMemo, useState } from 'react'
import { useWorkflow } from '../WorkflowContext'
import { NodeActionsToolbar, type NodeAction } from '../components/NodeActionsToolbar'
import { standardNodeActions } from '../components/nodeActions'
import { wfColors, wfRadius, wfShadow } from '../theme/workflowTheme'

/**
 * Sticky Note — post-it para anotações livres no canvas. Diferente
 * do Note (TextNode, que entra no pipeline com handles): sticky é
 * puramente visual, sem conexões. Útil pra lembretes, briefings,
 * instruções pro time.
 *
 * Cores pré-definidas (amarelo, rosa, verde, azul) — user escolhe
 * pelo context menu de cores padrão do canvas.
 */

const DEFAULT_BG = '#FEF08A' // amarelo post-it
const TEXT_ON_STICKY = '#1A1308'

export function StickyNote({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { updateNode, duplicateNode, deleteNode } = useWorkflow()
  const persistedText = (data.text as string) ?? ''
  const bg = (data.color as string) || DEFAULT_BG

  const [localText, setLocalText] = useState(persistedText)
  const [editing, setEditing] = useState(persistedText === '')

  const commit = useCallback(() => {
    setEditing(false)
    if (localText !== persistedText) {
      updateNode(id, { content: { text: localText } })
    }
  }, [id, localText, persistedText, updateNode])

  const actions: NodeAction[] = useMemo(
    () => standardNodeActions(id, { duplicateNode, deleteNode }),
    [id, duplicateNode, deleteNode],
  )

  return (
    <div style={{ position: 'relative' }}>
      <NodeActionsToolbar actions={actions} />
      <div
        style={{
          width: 200,
          minHeight: 120,
          padding: '14px 14px 18px',
          background: bg,
          borderRadius: wfRadius.control,
          boxShadow: selected
            ? `0 0 0 2px ${bg}, 0 12px 28px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.35)`
            : '0 6px 16px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
          // Leve rotação pra feel de post-it sem exagero
          transform: `rotate(${hashToRotation(id)}deg)`,
          color: TEXT_ON_STICKY,
          fontFamily: '"Caveat", "Patrick Hand", "Kalam", cursive',
          transition: 'box-shadow 160ms ease',
        }}
      >
        {editing ? (
          <textarea
            value={localText}
            onChange={e => setLocalText(e.target.value)}
            onBlur={commit}
            autoFocus
            className="nodrag"
            placeholder="Anote algo…"
            style={{
              width: '100%', minHeight: 90,
              background: 'transparent', border: 'none',
              color: TEXT_ON_STICKY,
              fontSize: 15,
              fontFamily: 'inherit',
              resize: 'vertical', outline: 'none',
              lineHeight: 1.4,
            }}
          />
        ) : (
          <div
            onDoubleClick={() => setEditing(true)}
            style={{
              fontSize: 15, lineHeight: 1.4, cursor: 'text',
              whiteSpace: 'pre-wrap', minHeight: 90,
            }}
          >
            {localText || (
              <span style={{ color: 'rgba(26,19,8,0.4)' }}>Double-click pra anotar</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Rotação determinística (-2° a +2°) a partir do hash do ID, pra
 * dar variedade entre sticky notes sem flutuar a cada render.
 */
function hashToRotation(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  }
  return ((Math.abs(hash) % 5) - 2) // -2..+2
}
