'use client'

import React from 'react'

/**
 * Componente base de todos os ícones do Bear Studio.
 * Renderiza um SVG 24x24 com stroke em `currentColor` (herda do parent
 * via prop color ou via CSS). API compatível com Lucide — troca direta.
 *
 * Cada ícone concreto passa seus `paths` (filhos do <svg>) e herda
 * todos os atributos comuns.
 */
export interface BearIconProps {
  size?: number | string
  color?: string
  /** Espessura do traço. Default 1.25 — alinhado com o handoff do design. */
  strokeWidth?: number
  className?: string
  style?: React.CSSProperties
  title?: string
}

interface BearIconBaseProps extends BearIconProps {
  children: React.ReactNode
}

export function BearIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 1.25,
  className,
  style,
  title,
  children,
}: BearIconBaseProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  )
}
