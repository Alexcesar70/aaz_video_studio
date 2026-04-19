'use client'

import React, { useEffect, useRef, useState } from 'react'
import { UIIcons, DEFAULT_ICON_PROPS } from '../../theme/icons'
import { wfColors, wfRadius, wfShadow } from '../../theme/workflowTheme'

/**
 * Dropdown compacto genérico pra uso dentro de nós (seletor de modelo,
 * aspect ratio, etc). Stateless — recebe opções, valor e callback.
 *
 * Design: pill fino com caret à direita, abre painel abaixo.
 * Clica fora / ESC fecha.
 */

export interface SelectOption {
  value: string
  label: string
  hint?: string
}

export interface SelectControlProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Ícone opcional à esquerda do valor atual */
  leftAdornment?: React.ReactNode
  disabled?: boolean
  minWidth?: number | string
}

export function SelectControl({
  options,
  value,
  onChange,
  placeholder = 'Selecionar',
  leftAdornment,
  disabled = false,
  minWidth = 90,
}: SelectControlProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    const onDown = (ev: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(ev.target as Node)) setOpen(false)
    }
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="nodrag" style={{ position: 'relative', minWidth }}>
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          width: '100%', padding: '4px 8px',
          background: wfColors.surfaceDeep,
          border: `1px solid ${wfColors.border}`,
          borderRadius: wfRadius.control,
          color: wfColors.text,
          fontSize: 10, fontFamily: 'inherit',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          height: 22,
        }}
      >
        {leftAdornment}
        <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selected?.label ?? placeholder}
        </span>
        <UIIcons.chevronDown size={10} color={wfColors.textDim} {...DEFAULT_ICON_PROPS} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0,
            minWidth: '100%',
            zIndex: 50,
            background: wfColors.surface,
            border: `1px solid ${wfColors.border}`,
            borderRadius: wfRadius.inner,
            boxShadow: wfShadow.menu,
            maxHeight: 240, overflowY: 'auto',
            padding: 2,
          }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                width: '100%', padding: '6px 8px',
                background: opt.value === value ? wfColors.border : 'transparent',
                border: 'none', borderRadius: wfRadius.control,
                color: wfColors.text,
                fontSize: 11, fontFamily: 'inherit',
                cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = wfColors.surfaceDeep }}
              onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent' }}
            >
              <span>{opt.label}</span>
              {opt.hint && <span style={{ fontSize: 9, color: wfColors.textFaint }}>{opt.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
