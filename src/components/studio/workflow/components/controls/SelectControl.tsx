'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { UIIcons, DEFAULT_ICON_PROPS } from '../../theme/icons'
import { wfColors, wfRadius, wfShadow } from '../../theme/workflowTheme'

/**
 * Dropdown compacto pra uso dentro de nós do canvas (model picker,
 * aspect picker, etc). Stateless — recebe opções, valor e callback.
 *
 * Painel de opções é renderizado via React Portal (document.body) com
 * position: fixed. Isso evita ser cortado pelo `overflow: hidden` do
 * NodeShell que envolve cada nó (caso contrário só algumas opções
 * apareciam visíveis).
 *
 * Posicionamento: anchor logo abaixo do botão, calculado a partir do
 * getBoundingClientRect. Recalcula em open + scroll/resize.
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

interface PanelPos {
  top: number
  left: number
  width: number
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
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Calcula posição do painel a partir do trigger
  const recalc = () => {
    const trigger = triggerRef.current
    if (!trigger) return
    const r = trigger.getBoundingClientRect()
    setPanelPos({
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 160),
    })
  }

  useLayoutEffect(() => {
    if (!open) return
    recalc()
  }, [open])

  // Click fora / ESC / scroll/resize
  useEffect(() => {
    if (!open) return
    const onDown = (ev: MouseEvent) => {
      const t = ev.target as Node
      if (
        triggerRef.current && !triggerRef.current.contains(t) &&
        panelRef.current && !panelRef.current.contains(t)
      ) {
        setOpen(false)
      }
    }
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setOpen(false) }
    const onReposition = () => recalc()
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onReposition, true)
    window.addEventListener('resize', onReposition)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onReposition, true)
      window.removeEventListener('resize', onReposition)
    }
  }, [open])

  return (
    <div className="nodrag" style={{ position: 'relative', minWidth, display: 'inline-block' }}>
      <button
        ref={triggerRef}
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

      {/* Painel via portal pra escapar do overflow:hidden do NodeShell */}
      {open && mounted && panelPos && createPortal(
        <div
          ref={panelRef}
          className="nodrag nowheel"
          style={{
            position: 'fixed',
            top: panelPos.top,
            left: panelPos.left,
            minWidth: panelPos.width,
            zIndex: 9999,
            background: wfColors.surface,
            border: `1px solid ${wfColors.border}`,
            borderRadius: wfRadius.inner,
            boxShadow: wfShadow.menu,
            maxHeight: 280, overflowY: 'auto',
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
        </div>,
        document.body,
      )}
    </div>
  )
}
