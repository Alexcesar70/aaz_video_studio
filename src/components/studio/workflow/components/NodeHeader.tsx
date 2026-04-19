'use client'

import React from 'react'
import type { NodeType } from '@/modules/workflow'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { getNodeTypeIcon, DEFAULT_ICON_PROPS } from '../theme/icons'
import { wfColors } from '../theme/workflowTheme'

/**
 * Header padrão de qualquer nó: ícone + label tipográfico minúsculo à esquerda,
 * slot à direita pra status/ações (ex: "gerando...", "3 outputs").
 *
 * Stateless — recebe tudo por props.
 */
export interface NodeHeaderProps {
  type: NodeType
  /** Override do label (ex: nome customizado do nó) */
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
        marginBottom: 8,
        fontSize: 10,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: wfColors.textDim,
        ...style,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={13} color={color} {...DEFAULT_ICON_PROPS} />
        <span style={{ fontWeight: 600 }}>{label ?? meta.label}</span>
      </span>
      {right !== undefined && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, textTransform: 'none', letterSpacing: 0 }}>
          {right}
        </span>
      )}
    </div>
  )
}
