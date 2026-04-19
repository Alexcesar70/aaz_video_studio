'use client'

import React, { useEffect, useRef, useState } from 'react'
import { UIIcons, DEFAULT_ICON_PROPS } from '../../theme/icons'
import { wfColors, wfRadius, wfShadow } from '../../theme/workflowTheme'

/**
 * Dropdown compacto pra uso dentro de nós do canvas (model picker,
 * aspect picker, etc). Stateless — recebe opções, valor e callback.
 *
 * Posicionamento: painel abre logo abaixo do trigger via `position:
 * absolute`. Pra não ser cortado pelo card, o NodeShell usa
 * `overflow: visible` (previews internos têm seu próprio overflow).
 * Evitamos portal pro body porque isso quebra alinhamento quando o
 * canvas aplica transforms (pan/zoom do xyflow).
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
    <div
      ref={rootRef}
      className="nodrag nowheel"
      style={{ position: 'relative', minWidth, display: 'inline-block' }}
    >
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          width: '100%', padding: '4px 8px',
          background: wfColors.surfaceDeep,
          border: `1px solid ${open ? wfColors.borderStrong : wfColors.border}`,
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
        <UIIcons.chevronDown
          size={10}
          color={wfColors.textDim}
          {...DEFAULT_ICON_PROPS}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease' }}
        />
      </button>

      {open && (
        <div
          className="nodrag nowheel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: '100%',
            zIndex: 999,
            background: wfColors.surface,
            border: `1px solid ${wfColors.border}`,
            borderRadius: wfRadius.inner,
            boxShadow: wfShadow.menu,
            maxHeight: 260, overflowY: 'auto',
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
                whiteSpace: 'nowrap',
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
