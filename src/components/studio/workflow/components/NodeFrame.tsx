'use client'

import React from 'react'
import type { DataType } from '../theme/nodeTypeMeta'
import { TypedHandle } from './TypedHandle'
import { NodeActionsToolbar, type NodeAction } from './NodeActionsToolbar'

/**
 * Layout padrão de qualquer nó do Workflow. Encapsula:
 * - NodeActionsToolbar flutuante (xyflow portal)
 * - Handles tipados LATERAIS (inputs esquerda, outputs direita)
 *
 * Stateless + declarativo: o nó concreto passa `inputs/outputs/actions`
 * e o Frame cuida de posicionar/distribuir. Uncle Bob — Frame tem uma
 * responsabilidade: compor layout visual do nó.
 *
 * @example
 * <NodeFrame
 *   inputs={[{ dataType: 'text' }]}
 *   outputs={[{ dataType: 'image' }]}
 *   actions={standardNodeActions(id, ctx)}
 * >
 *   <NodeShell>...</NodeShell>
 * </NodeFrame>
 */

export interface HandleSpec {
  dataType: DataType
  id?: string
  label?: string
}

export interface NodeFrameProps {
  inputs?: HandleSpec[]
  outputs?: HandleSpec[]
  actions?: NodeAction[]
  children: React.ReactNode
}

export function NodeFrame({ inputs = [], outputs = [], actions = [], children }: NodeFrameProps) {
  return (
    <div style={{ position: 'relative' }}>
      {actions.length > 0 && <NodeActionsToolbar actions={actions} />}

      {/* Inputs na lateral esquerda, distribuídos verticalmente */}
      {inputs.map((h, idx) => (
        <TypedHandle
          key={`in-${h.id ?? `${h.dataType}-${idx}`}`}
          kind="target"
          side="left"
          dataType={h.dataType}
          id={h.id}
          label={h.label}
          verticalAnchor={computeAnchor(idx, inputs.length)}
        />
      ))}

      {children}

      {/* Outputs na lateral direita, distribuídos verticalmente */}
      {outputs.map((h, idx) => (
        <TypedHandle
          key={`out-${h.id ?? `${h.dataType}-${idx}`}`}
          kind="source"
          side="right"
          dataType={h.dataType}
          id={h.id}
          label={h.label}
          verticalAnchor={computeAnchor(idx, outputs.length)}
        />
      ))}
    </div>
  )
}

/**
 * Distribui `total` handles igualmente pelo eixo vertical do card.
 * 1 handle → 50% (centro). 2 → 33% / 66%. 3 → 25% / 50% / 75%. Etc.
 */
function computeAnchor(index: number, total: number): number {
  if (total <= 1) return 0.5
  return (index + 1) / (total + 1)
}
