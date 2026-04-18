'use client'
import React, { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useWorkflow } from '../WorkflowContext'
import { SmartPrompter } from '../../SmartPrompter'

export function PromptNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { updateNode, generateImageFromPrompt } = useWorkflow()
  const color = '#AFA9EC'
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

  const selectCount = (n: 1 | 2 | 4) => {
    setCount(n)
    updateNode(id, { content: { count: n } })
  }

  const handleRefined = (refined: string) => {
    setText(refined)
    setShowRefiner(false)
    updateNode(id, { content: { text: refined } })
  }

  return (
    <div style={{
      background: '#1a1730',
      border: `2px solid ${selected ? color : '#2A2545'}`,
      borderRadius: 10,
      padding: 12,
      width: 280,
      boxShadow: selected ? `0 0 16px ${color}30` : 'none',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: color, width: 8, height: 8 }} />

      <div style={{ fontSize: 10, color: '#9F9AB8', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>✍️</span> Prompt
        </span>
        {generating && <span style={{ color: '#E5B87A' }}>⏳ gerando...</span>}
      </div>

      {editing ? (
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={commitText}
          autoFocus
          placeholder="Descreva a imagem..."
          className="nodrag"
          style={{
            width: '100%', minHeight: 80, padding: 8, borderRadius: 6,
            background: '#0f0d1a', border: '1px solid #2A2545',
            color: '#E8E5F0', fontSize: 12, fontFamily: 'inherit',
            resize: 'vertical', outline: 'none', marginBottom: 8,
          }}
        />
      ) : (
        <div
          onDoubleClick={() => setEditing(true)}
          style={{
            fontSize: 12, color: text ? '#E8E5F0' : '#6B6688',
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
          padding: '6px 8px', marginBottom: 8, borderRadius: 4,
          background: '#ff5d7a15', border: '1px solid #ff5d7a30',
          fontSize: 10, color: '#ff5d7a',
        }}>
          {error}
        </div>
      )}

      <div className="nodrag" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        <span style={{ fontSize: 10, color: '#9F9AB8', marginRight: 2 }}>Variações:</span>
        {([1, 2, 4] as const).map(n => (
          <button
            key={n}
            onClick={() => selectCount(n)}
            disabled={generating}
            style={{
              padding: '3px 8px', borderRadius: 4,
              background: count === n ? `${color}30` : 'transparent',
              border: `1px solid ${count === n ? color : '#2A2545'}`,
              color: count === n ? color : '#9F9AB8',
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
            flex: 1, padding: '6px 8px', borderRadius: 6,
            background: showRefiner ? `${color}25` : 'transparent',
            border: `1px solid ${text.trim() ? `${color}40` : '#2A2545'}`,
            color: text.trim() ? color : '#6B6688',
            fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            cursor: text.trim() ? 'pointer' : 'default',
          }}
        >
          ⚡ Refinar
        </button>
        <button
          onClick={handleGenerate}
          disabled={!text.trim() || generating}
          style={{
            flex: 1, padding: '6px 8px', borderRadius: 6,
            background: text.trim() && !generating ? '#5DCAA5' : '#2A2545',
            border: 'none',
            color: text.trim() && !generating ? '#0A0814' : '#6B6688',
            fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
            cursor: text.trim() && !generating ? 'pointer' : 'default',
          }}
        >
          {generating ? '⏳' : `▶ Gerar${count > 1 ? ` (${count})` : ''}`}
        </button>
      </div>

      {showRefiner && text.trim() && (
        <div className="nodrag" style={{ marginTop: 10 }}>
          <SmartPrompter prompt={text} onRefined={handleRefined} />
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ background: color, width: 8, height: 8 }} />
    </div>
  )
}
