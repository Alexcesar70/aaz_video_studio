'use client'

import React from 'react'
import type { NodeType } from '@/modules/workflow'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { wfColors, wfRadius, wfShadow } from '../theme/workflowTheme'

/**
 * Wrapper visual genérico de todos os nós do Workflow.
 * Não contém lógica — só aplica estilo consistente (card dark, borda
 * tipada, sombra selected, padding padrão). Composition-first.
 *
 * @example
 * <NodeShell type="image" selected={selected} width={220}>
 *   <NodeHeader type="image" />
 *   ...conteúdo
 * </NodeShell>
 */
export interface NodeShellProps {
  type: NodeType
  selected?: boolean
  /** Força uma cor de borda diferente do meta (ex: quando user muda cor via menu) */
  colorOverride?: string
  /** Controle de largura — se omitido, nó fica auto-width */
  width?: number | string
  minWidth?: number | string
  maxWidth?: number | string
  padding?: number | string
  /** Remove padding interno (útil pra nós com media full-bleed) */
  flush?: boolean
  /** Remove background (útil pra nós customizados que querem seu próprio fundo) */
  transparent?: boolean
  /**
   * Halo laranja "pôr-do-sol" indicando atividade/geração.
   * - true ou 'pulse': pulsa continuamente (loading)
   * - 'flash': flash único decaindo (sucesso)
   * - false | undefined: sem halo
   */
  glow?: boolean | 'pulse' | 'flash'
  style?: React.CSSProperties
  children: React.ReactNode
}

export function NodeShell({
  type,
  selected = false,
  colorOverride,
  width,
  minWidth,
  maxWidth,
  padding,
  flush = false,
  transparent = false,
  glow,
  style,
  children,
}: NodeShellProps) {
  const meta = getNodeTypeMeta(type)
  const accent = colorOverride || meta.color
  const borderColor = glow ? wfColors.glow : (selected ? accent : wfColors.border)

  // Animações definidas em globals.css (wf-glow-pulse / wf-glow-flash)
  const glowAnimation = glow === 'flash'
    ? 'wf-glow-flash 900ms ease-out 1'
    : glow
      ? 'wf-glow-pulse 1.6s ease-in-out infinite'
      : undefined

  const defaultShadow = selected ? wfShadow.cardSelected(accent) : wfShadow.card

  return (
    <div
      style={{
        background: transparent ? 'transparent' : wfColors.surface,
        border: `1px solid ${borderColor}`,
        borderRadius: wfRadius.card,
        boxShadow: glow ? undefined : defaultShadow, // animation controla box-shadow quando glow
        animation: glowAnimation,
        color: wfColors.text,
        overflow: 'hidden',
        padding: flush ? 0 : padding ?? 12,
        width,
        minWidth,
        maxWidth,
        transition: 'box-shadow 150ms ease, border-color 150ms ease',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
