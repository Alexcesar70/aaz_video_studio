'use client'

/**
 * Atoms visuais do Studio — Pill, Label, Divider, Input.
 *
 * Extraídos de AAZStudio.tsx (M2-PR7). Todos consumem a paleta via
 * `C` do theme — zero hardcode de hex no call site.
 */

import React from 'react'
import { C } from './theme'

export const Pill = ({
  children,
  color = C.gold,
  style = {},
}: {
  children: React.ReactNode
  color?: string
  style?: React.CSSProperties
}) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '4px 12px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      background: `${color}18`,
      color,
      border: `1px solid ${color}35`,
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {children}
  </span>
)

export const Label = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      fontSize: 13,
      fontWeight: 700,
      color: C.text,
      letterSpacing: '0.5px',
      marginBottom: 10,
    }}
  >
    {children}
  </div>
)

export const Divider = () => (
  <div style={{ borderTop: `1px solid ${C.border}`, margin: '10px 0' }} />
)

export const Input = ({
  style = {},
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: '10px 14px',
      color: C.text,
      fontSize: 14,
      outline: 'none',
      fontFamily: 'inherit',
      width: '100%',
      boxSizing: 'border-box',
      ...style,
    }}
    {...props}
  />
)
