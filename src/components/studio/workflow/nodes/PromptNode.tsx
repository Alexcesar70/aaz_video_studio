'use client'
import React, { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useWorkflow } from '../WorkflowContext'
import { SmartPrompter } from '../../SmartPrompter'
import { NodeShell } from '../components/NodeShell'
import { NodeHeader } from '../components/NodeHeader'
import { NodeActionsToolbar, type NodeAction } from '../components/NodeActionsToolbar'
import { standardNodeActions } from '../components/nodeActions'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { ActionIcons, UIIcons, DEFAULT_ICON_PROPS } from '../theme/icons'
import { wfColors, wfRadius } from '../theme/workflowTheme'

export function PromptNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { updateNode, generateImageFromPrompt, duplicateNode, deleteNode } = useWorkflow()
  const accent = (data.color as string) || getNodeTypeMeta('prompt').color
  const initialText = (data.text as string) ?? ''

  const [text, setText] = useState(initialText)
  const [editing, setEditing] = useState(initialText === '')
  const [showRefiner, setShowRefiner] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState<1 | 2 | 4>(((data.count as 1 | 2 | 4) ?? 1))

  const commitText = () => {
    setEditing(false)
    if (text !== initialText) {
      updateNode(id, { content: { text } })
    }
  }

  const handleGenerate = async () => {
    if (generating || !text.trim()) return
    setGenerating(true)
    setError(null)
    const result = await generateImageFromPrompt(id, text, count)
    setGenerating(false)
    if (!result.ok) setError(result.error ?? 'Erro ao gerar.')
  }

  const handleRefined = (refined: string) => {
    setText(refined)
    setShowRefiner(false)
    updateNode(id, { content: { text: refined } })
  }

  const selectCount = (n: 1 | 2 | 4) => {
    setCount(n)
    updateNode(id, { content: { count: n } })
  }

  const actions: NodeAction[] = [
    {
      id: 'run',
      icon: <ActionIcons.run size={14} {...DEFAULT_ICON_PROPS} />,
      title: 'Gerar agora',
      tone: 'primary',
      disabled: !text.trim() || generating,
      onClick: () => { void handleGenerate() },
    },
    ...standardNodeActions(id, { duplicateNode, deleteNode }),
  ]

  return (
    <NodeShell type="prompt" selected={selected} colorOverride={accent} width={280}>
      <NodeActionsToolbar actions={actions} />
      <Handle type="target" position={Position.Left} style={{ background: accent, width: 8, height: 8 }} />

      <NodeHeader
        type="prompt"
        accent={accent}
        right={generating ? (
          <span style={{ fontSize: 10, color: '#E5B87A' }}>⏳ gerando...</span>
        ) : undefined}
      />

      {editing ? (
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={commitText}
          autoFocus
          placeholder="Descreva a imagem..."
          className="nodrag"
          style={{
            width: '100%', minHeight: 80, padding: 8, borderRadius: wfRadius.inner,
            background: wfColors.surfaceDeep, border: `1px solid ${wfColors.border}`,
            color: wfColors.text, fontSize: 12, fontFamily: 'inherit',
            resize: 'vertical', outline: 'none', marginBottom: 8,
          }}
        />
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          style={{
            fontSize: 12, color: text ? wfColors.text : wfColors.textFaint,
            lineHeight: 1.5, cursor: 'text', minHeight: 30,
            marginBottom: 8, whiteSpace: 'pre-wrap',
            maxHeight: 120, overflowY: 'auto',
          }}
        >
          {text || 'Double-click pra escrever um prompt...'}
        </div>
      )}

      {error && (
        <div style={{
          padding: '6px 8px', marginBottom: 8, borderRadius: wfRadius.control,
          background: '#ff5d7a15', border: '1px solid #ff5d7a30',
          fontSize: 10, color: '#ff5d7a',
        }}>
          {error}
        </div>
      )}

      <div className="nodrag" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: wfColors.textDim, marginRight: 2 }}>Variações:</span>
        {([1, 2, 4] as const).map(n => (
          <button
            key={n}
            onClick={() => selectCount(n)}
            disabled={generating}
            style={{
              padding: '3px 8px', borderRadius: 4,
              background: count === n ? `${accent}30` : 'transparent',
              border: `1px solid ${count === n ? accent : wfColors.border}`,
              color: count === n ? accent : wfColors.textDim,
              fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
              cursor: generating ? 'default' : 'pointer',
            }}
          >{n}</button>
        ))}
      </div>

      <div className="nodrag" style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => setShowRefiner(s => !s)}
          disabled={!text.trim() || generating}
          style={{
            flex: 1, padding: '6px 10px', borderRadius: wfRadius.control,
            background: showRefiner ? `${accent}25` : 'transparent',
            border: `1px solid ${text.trim() ? `${accent}40` : wfColors.border}`,
            color: text.trim() ? accent : wfColors.textFaint,
            fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            cursor: text.trim() ? 'pointer' : 'default',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <UIIcons.refine size={12} {...DEFAULT_ICON_PROPS} /> Refinar
        </button>
        <button
          onClick={handleGenerate}
          disabled={!text.trim() || generating}
          style={{
            flex: 1, padding: '6px 10px', borderRadius: wfRadius.control,
            background: text.trim() && !generating ? '#5DCAA5' : wfColors.border,
            border: 'none',
            color: text.trim() && !generating ? '#0A0814' : wfColors.textFaint,
            fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
            cursor: text.trim() && !generating ? 'pointer' : 'default',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <ActionIcons.run size={12} {...DEFAULT_ICON_PROPS} />
          {generating ? 'Gerando...' : `Gerar${count > 1 ? ` (${count})` : ''}`}
        </button>
      </div>

      {showRefiner && text.trim() && (
        <div className="nodrag" style={{ marginTop: 10 }}>
          <SmartPrompter prompt={text} onRefined={handleRefined} />
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: accent, width: 8, height: 8 }} />
    </NodeShell>
  )
}
