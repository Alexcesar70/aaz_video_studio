'use client'

import React, { useEffect, useRef, useState } from 'react'
import { CANVAS_PALETTE, DEFAULT_CANVAS_BG, type CanvasBackground } from '../theme/canvasPalette'
import { wfColors, wfRadius, wfShadow } from '../theme/workflowTheme'

/**
 * Botão com swatch da cor atual que abre um popover com grid de
 * swatches. Click fora ou ESC fecha. Stateless quanto ao valor —
 * controle via props.
 */

export interface CanvasBackgroundPickerProps {
  current: string
  onChange: (value: string) => void
}

export function CanvasBackgroundPicker({ current, onChange }: CanvasBackgroundPickerProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

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

  const select = (bg: CanvasBackground) => {
    onChange(bg.value)
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="nodrag nowheel" style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Cor do canvas"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 8px', borderRadius: wfRadius.control,
          background: 'transparent', border: `1px solid ${wfColors.border}`,
          color: wfColors.text, cursor: 'pointer',
          fontSize: 11, fontFamily: 'inherit', height: 26,
        }}
      >
        {/* Swatch da cor atual */}
        <span style={{
          display: 'inline-block', width: 14, height: 14, borderRadius: 3,
          background: current,
          border: `1px solid ${wfColors.border}`,
        }} />
        <span>Cor</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0,
            zIndex: 999, padding: 10,
            background: wfColors.surface,
            border: `1px solid ${wfColors.border}`,
            borderRadius: wfRadius.inner,
            boxShadow: wfShadow.menu,
            minWidth: 260,
          }}
        >
          {/* Default (gradient original) como primeira opção destacada */}
          <button
            onClick={() => select(DEFAULT_CANVAS_BG)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '6px 8px', marginBottom: 8,
              background: current === DEFAULT_CANVAS_BG.value ? wfColors.border : 'transparent',
              border: `1px dashed ${wfColors.borderStrong}`,
              borderRadius: wfRadius.control,
              color: wfColors.text, fontSize: 11, fontFamily: 'inherit',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{
              display: 'inline-block', width: 18, height: 18, borderRadius: 3,
              background: DEFAULT_CANVAS_BG.swatch,
              border: `1px solid ${wfColors.border}`,
            }} />
            <span style={{ flex: 1 }}>Bear (padrão)</span>
            <span style={{ fontSize: 9, color: wfColors.textFaint }}>gradient</span>
          </button>

          {/* Grid de swatches sólidos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {CANVAS_PALETTE.map((row, r) => (
              <div key={r} style={{ display: 'flex', gap: 3 }}>
                {row.map((bg, c) => {
                  const active = bg.value === current
                  return (
                    <button
                      key={c}
                      onClick={() => select(bg)}
                      title={bg.label}
                      style={{
                        width: 26, height: 22, padding: 0,
                        background: bg.swatch,
                        border: `2px solid ${active ? wfColors.text : 'transparent'}`,
                        borderRadius: 3,
                        cursor: 'pointer',
                        transition: 'border-color 120ms ease, transform 120ms ease',
                      }}
                    />
                  )
                })}
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 8, paddingTop: 6, borderTop: `1px solid ${wfColors.border}`,
            fontSize: 9, color: wfColors.textFaint, textAlign: 'center',
          }}>
            Salvo no navegador
          </div>
        </div>
      )}
    </div>
  )
}
