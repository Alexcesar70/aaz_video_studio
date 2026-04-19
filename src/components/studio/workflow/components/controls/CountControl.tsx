'use client'

import React from 'react'
import { wfColors, wfRadius } from '../../theme/workflowTheme'

/**
 * Toggle de 3 valores pra quantidade (1 / 2 / 4). Componente simples
 * e isolado — usado no Image/Video Generator pra escolher variações.
 */
export interface CountControlProps<T extends number> {
  value: T
  options: readonly T[]
  onChange: (next: T) => void
  disabled?: boolean
  accent: string
}

export function CountControl<T extends number>({
  value, options, onChange, disabled = false, accent,
}: CountControlProps<T>) {
  return (
    <div className="nodrag" style={{ display: 'inline-flex', gap: 2 }}>
      {options.map(n => {
        const active = n === value
        return (
          <button
            key={n}
            onClick={() => !disabled && onChange(n)}
            disabled={disabled}
            style={{
              minWidth: 22, height: 22,
              padding: '0 6px', borderRadius: wfRadius.control,
              background: active ? `${accent}30` : 'transparent',
              border: `1px solid ${active ? accent : wfColors.border}`,
              color: active ? accent : wfColors.textDim,
              fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
              cursor: disabled ? 'default' : 'pointer',
            }}
          >{n}</button>
        )
      })}
    </div>
  )
}
