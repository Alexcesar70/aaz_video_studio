'use client'

import React, { useEffect, useRef } from 'react'
import { useWorkflow } from './WorkflowContext'

export interface ContextMenuState {
  nodeId: string
  x: number
  y: number
}

interface Props {
  state: ContextMenuState
  onClose: () => void
}

const COLORS = [
  { value: '', label: 'Padrão' },
  { value: '#7F77DD', label: 'Roxo' },
  { value: '#5DCAA5', label: 'Verde' },
  { value: '#E5B87A', label: 'Âmbar' },
  { value: '#D4A0C8', label: 'Rosa' },
  { value: '#AFA9EC', label: 'Lavanda' },
]

export function NodeContextMenu({ state, onClose }: Props) {
  const { duplicateNode, deleteNode, updateNode } = useWorkflow()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) onClose()
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const handle = (fn: () => void) => () => {
    fn()
    onClose()
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', top: state.y, left: state.x, zIndex: 1000,
        minWidth: 160, padding: 4,
        background: '#1a1730', border: '1px solid #2A2545', borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        fontFamily: 'inherit',
      }}
    >
      <button
        onClick={handle(() => duplicateNode(state.nodeId))}
        style={menuItemStyle}
      >
        <span style={{ width: 18 }}>⎘</span> Duplicar
        <span style={{ marginLeft: 'auto', fontSize: 9, color: '#6B6688' }}>⌘D</span>
      </button>
      <button
        onClick={handle(() => deleteNode(state.nodeId))}
        style={{ ...menuItemStyle, color: '#ff5d7a' }}
      >
        <span style={{ width: 18 }}>✕</span> Deletar
        <span style={{ marginLeft: 'auto', fontSize: 9, color: '#6B6688' }}>Del</span>
      </button>

      <div style={{ height: 1, background: '#2A2545', margin: '4px 0' }} />

      <div style={{ padding: '4px 8px', fontSize: 9, color: '#9F9AB8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Cor
      </div>
      <div style={{ display: 'flex', gap: 4, padding: '2px 8px 6px', flexWrap: 'wrap' }}>
        {COLORS.map(c => (
          <button
            key={c.value || 'default'}
            onClick={handle(() => updateNode(state.nodeId, { color: c.value || undefined }))}
            title={c.label}
            style={{
              width: 18, height: 18, borderRadius: 4, padding: 0,
              background: c.value || 'transparent',
              border: c.value ? '1px solid #2A2545' : '1px dashed #6B6688',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>
    </div>
  )
}

const menuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
  padding: '6px 8px', borderRadius: 4,
  background: 'transparent', border: 'none',
  color: '#E8E5F0', fontSize: 11, fontFamily: 'inherit',
  cursor: 'pointer', textAlign: 'left',
}
