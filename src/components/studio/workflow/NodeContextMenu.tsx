'use client'

import React, { useEffect, useRef } from 'react'
import { useWorkflow } from './WorkflowContext'
import { wfColors, wfRadius, wfShadow } from './theme/workflowTheme'
import { ActionIcons, DEFAULT_ICON_PROPS } from './theme/icons'

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
  { value: '#8B5CF6', label: 'Roxo' },
  { value: '#06B6D4', label: 'Ciano' },
  { value: '#C6D66E', label: 'Verde' },
  { value: '#E59866', label: 'Âmbar' },
  { value: '#D4A0C8', label: 'Rosa' },
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
        minWidth: 170, padding: 4,
        background: wfColors.surface, border: `1px solid ${wfColors.border}`,
        borderRadius: wfRadius.inner, boxShadow: wfShadow.menu,
        backdropFilter: 'blur(8px)',
        fontFamily: 'inherit',
      }}
    >
      <button
        onClick={handle(() => duplicateNode(state.nodeId))}
        style={menuItemStyle}
      >
        <ActionIcons.duplicate size={13} {...DEFAULT_ICON_PROPS} />
        <span>Duplicar</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: wfColors.textFaint }}>⌘D</span>
      </button>
      <button
        onClick={handle(() => deleteNode(state.nodeId))}
        style={{ ...menuItemStyle, color: '#ff5d7a' }}
      >
        <ActionIcons.delete size={13} {...DEFAULT_ICON_PROPS} />
        <span>Deletar</span>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: wfColors.textFaint }}>Del</span>
      </button>

      <div style={{ height: 1, background: wfColors.border, margin: '4px 0' }} />

      <div style={{ padding: '4px 8px', fontSize: 9, color: wfColors.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
              border: c.value ? `1px solid ${wfColors.border}` : `1px dashed ${wfColors.textFaint}`,
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
  color: wfColors.text, fontSize: 11, fontFamily: 'inherit',
  cursor: 'pointer', textAlign: 'left',
}
