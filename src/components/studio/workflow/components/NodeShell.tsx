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
  style,
  children,
}: NodeShellProps) {
  const meta = getNodeTypeMeta(type)
  const accent = colorOverride || meta.color
  const borderColor = selected ? accent : wfColors.border

  return (
    <div
      style={{
        background: transparent ? 'transparent' : wfColors.surface,
        border: `1px solid ${borderColor}`,
        borderRadius: wfRadius.card,
        boxShadow: selected ? wfShadow.cardSelected(accent) : wfShadow.card,
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
