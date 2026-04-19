'use client'
import React, { useState } from 'react'
import { useWorkflow } from '../WorkflowContext'
import { NodeShell } from '../components/NodeShell'
import { NodeHeader } from '../components/NodeHeader'
import { NodeFrame } from '../components/NodeFrame'
import { standardNodeActions } from '../components/nodeActions'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { wfColors, wfRadius } from '../theme/workflowTheme'

/**
 * PromptNode — LEGADO. Originalmente continha SmartPrompter inline +
 * botão Gerar. Hoje essas responsabilidades estão divididas em:
 *   - TextNode      → escreve prompt
 *   - SmartPrompter → refina (separado, conectado por edge)
 *   - ImageGen      → gera (separado, conectado por edge)
 *
 * Mantido apenas pra renderizar boards antigos sem quebrar. Comporta-se
 * como editor de texto simples: edita data.text, expõe como output text.
 * Não tem mais botão Refinar nem Gerar dentro do card.
 */

export function PromptNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { updateNode, duplicateNode, deleteNode } = useWorkflow()
  const accent = (data.color as string) || getNodeTypeMeta('prompt').color
  const initialText = (data.text as string) ?? ''

  const [text, setText] = useState(initialText)
  const [editing, setEditing] = useState(initialText === '')

  const commitText = () => {
    setEditing(false)
    if (text !== initialText) {
      updateNode(id, { content: { text } })
    }
  }

  const actions = standardNodeActions(id, { duplicateNode, deleteNode })

  return (
    <NodeFrame
      inputs={[{ dataType: 'text' }]}
      outputs={[{ dataType: 'text' }]}
      actions={actions}
    >
      <NodeShell type="prompt" selected={selected} colorOverride={accent} width={300}>
        <NodeHeader type="prompt" accent={accent} />

        {editing ? (
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={commitText}
            autoFocus
            placeholder="Texto do prompt…"
            className="nodrag"
            style={{
              width: '100%', minHeight: 80, padding: 8, borderRadius: wfRadius.inner,
              background: wfColors.surfaceDeep, border: `1px solid ${wfColors.border}`,
              color: wfColors.text, fontSize: 12, fontFamily: 'inherit',
              resize: 'vertical', outline: 'none',
            }}
          />
        ) : (
          <div
            onDoubleClick={() => setEditing(true)}
            style={{
              fontSize: 12, color: text ? wfColors.text : wfColors.textFaint,
              lineHeight: 1.5, cursor: 'text', minHeight: 30,
              whiteSpace: 'pre-wrap', maxHeight: 140, overflowY: 'auto',
            }}
          >
            {text || 'Double-click pra escrever…'}
          </div>
        )}
      </NodeShell>
    </NodeFrame>
  )
}
