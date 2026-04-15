'use client'

/**
 * KpiCard — card de KPI usado no admin dashboard.
 * Extraído de AAZStudio.tsx (M4-PR6).
 */

import React from 'react'
import { C } from '../theme'

interface Props {
  label: string
  value: string
  sub?: string
  color: string
}

export function KpiCard({ label, value, sub, color }: Props) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${color}40`,
        borderRadius: 12,
        padding: 18,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: C.textDim,
          letterSpacing: '0.5px',
          marginBottom: 6,
        }}
      >
        {label.toUpperCase()}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          color,
          fontFamily: 'monospace',
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  )
}
