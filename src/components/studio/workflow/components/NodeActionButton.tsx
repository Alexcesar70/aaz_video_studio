'use client'

import React from 'react'
import { wfColors, wfRadius } from '../theme/workflowTheme'

/**
 * Botão com ícone pra toolbar flutuante do nó.
 * Stateless — recebe callback, ícone e title (tooltip nativo).
 */
export interface NodeActionButtonProps {
  icon: React.ReactNode
  title: string
  onClick: () => void
  /** Cor do ícone quando tem destaque (ex: delete = vermelho) */
  tone?: 'default' | 'danger' | 'primary'
  disabled?: boolean
}

export function NodeActionButton({ icon, title, onClick, tone = 'default', disabled = false }: NodeActionButtonProps) {
  const color = tone === 'danger' ? '#ff5d7a' : tone === 'primary' ? '#5DCAA5' : wfColors.text

  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title}
      disabled={disabled}
      className="nodrag"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 17, height: 17, padding: 0,
        background: 'transparent', border: 'none',
        borderRadius: wfRadius.control,
        color: disabled ? wfColors.textFaint : color,
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 9, fontFamily: 'inherit',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 120ms ease',
      }}
      onMouseEnter={e => {
        if (!disabled) e.currentTarget.style.background = wfColors.border
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {icon}
    </button>
  )
}
