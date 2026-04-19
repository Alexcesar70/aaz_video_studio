'use client'

import React from 'react'
import { NodeToolbar, Position } from '@xyflow/react'
import { NodeActionButton, type NodeActionButtonProps } from './NodeActionButton'
import { wfColors, wfRadius, wfShadow } from '../theme/workflowTheme'

export interface NodeAction extends NodeActionButtonProps {
  /** Identificador único pra key do React */
  id: string
}

export interface NodeActionsToolbarProps {
  actions: NodeAction[]
  /** Posição relativa ao nó (default = top) */
  position?: Position
  /** Força visibilidade (default = undefined → xyflow mostra só quando selected) */
  isVisible?: boolean
  /** Deslocamento da toolbar em relação ao nó */
  offset?: number
}

/**
 * Wrapper do `<NodeToolbar>` do xyflow com estilo padronizado.
 * Estilo: card flutuante dark com backdrop-blur, separador entre grupos
 * (use `kind: 'separator'` em um item). Stateless — lista de ações vem
 * por prop, portanto o nó mantém controle declarativo sobre o que expor.
 */
export function NodeActionsToolbar({
  actions,
  position = Position.Top,
  isVisible,
  offset = 8,
}: NodeActionsToolbarProps) {
  if (actions.length === 0) return null

  return (
    <NodeToolbar position={position} isVisible={isVisible} offset={offset}>
      <div
        className="nodrag"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 2,
          padding: 3,
          background: wfColors.surface,
          border: `1px solid ${wfColors.border}`,
          borderRadius: wfRadius.inner,
          boxShadow: wfShadow.toolbar,
          backdropFilter: 'blur(8px)',
        }}
      >
        {actions.map((action, idx) => {
          const prev = actions[idx - 1]
          const showSeparator = prev && isSeparatorBefore(action, prev)
          return (
            <React.Fragment key={action.id}>
              {showSeparator && (
                <div style={{ width: 1, height: 18, background: wfColors.border, margin: '0 2px' }} />
              )}
              <NodeActionButton {...action} />
            </React.Fragment>
          )
        })}
      </div>
    </NodeToolbar>
  )
}

/**
 * Regras de agrupamento visual: colocamos separador entre actions
 * "específicas do nó" e as "padrão" (duplicate/delete). Convenção: IDs
 * "duplicate" e "delete" disparam separador antes delas.
 */
function isSeparatorBefore(current: NodeAction, prev: NodeAction): boolean {
  const standardIds = new Set(['duplicate', 'delete'])
  return standardIds.has(current.id) && !standardIds.has(prev.id)
}
