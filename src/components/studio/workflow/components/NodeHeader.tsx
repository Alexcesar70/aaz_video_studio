'use client'

import React from 'react'
import type { NodeType } from '@/modules/workflow'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { getNodeTypeIcon, DEFAULT_ICON_PROPS } from '../theme/icons'
import { wfColors } from '../theme/workflowTheme'

/**
 * Header de qualquer nó. Por padrão mostra apenas o ícone do tipo à
 * esquerda (modo elegante/compacto) e permite slot customizado à direita
 * (status, score, timer).
 *
 * Se `label` for passado, renderiza também o texto ao lado do ícone
 * (útil pra Character/Scenario que têm nome customizado).
 *
 * Stateless — recebe tudo por props.
 */
export interface NodeHeaderProps {
  type: NodeType
  /** Texto opcional ao lado do ícone. Omitir = só ícone (padrão elegante). */
  label?: string
  /** Conteúdo à direita (status, badge, timer) */
  right?: React.ReactNode
  /** Override de cor do ícone (default = cor do tipo) */
  accent?: string
  style?: React.CSSProperties
}

export function NodeHeader({ type, label, right, accent, style }: NodeHeaderProps) {
  const meta = getNodeTypeMeta(type)
  const color = accent || meta.color
  const Icon = getNodeTypeIcon(type)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 6,
        color: wfColors.textDim,
        minHeight: 14,
        ...style,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={14} color={color} {...DEFAULT_ICON_PROPS} />
        {label && (
          <span style={{
            fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 600,
          }}>
            {label}
          </span>
        )}
      </span>
      {right !== undefined && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {right}
        </span>
      )}
    </div>
  )
}

