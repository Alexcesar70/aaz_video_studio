'use client'

import React from 'react'
import type { DataType } from '../theme/nodeTypeMeta'
import { TypedHandle } from './TypedHandle'
import { NodeActionsToolbar, type NodeAction } from './NodeActionsToolbar'

/**
 * Layout padrão de qualquer nó do Workflow — envolve o NodeShell com:
 * - Actions toolbar flutuante (xyflow portal)
 * - Handles tipados nos cantos (outputs TR, inputs BL — padrão Freepik)
 *
 * Stateless e declarativo — o nó só descreve o que tem, o frame cuida
 * de posicionamento e visual.
 *
 * @example
 * <NodeFrame
 *   inputs={[{ dataType: 'text', id: 'text-in' }]}
 *   outputs={[{ dataType: 'image' }]}
 *   actions={standardNodeActions(id, ctx)}
 * >
 *   <NodeShell>...</NodeShell>
 * </NodeFrame>
 */

export interface HandleSpec {
  dataType: DataType
  /** ID único dentro do nó quando há múltiplos handles */
  id?: string
  /** Label customizado pro tooltip — default: "Entrada: <tipo>" */
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

      {/* Inputs no canto inferior esquerdo (empilhados verticalmente quando N>1) */}
      {inputs.map((h, idx) => (
        <HandleStack
          key={`in-${h.id ?? idx}`}
          kind="target"
          side="bl"
          index={idx}
          total={inputs.length}
          spec={h}
        />
      ))}

      {children}

      {/* Outputs no canto superior direito (empilhados verticalmente quando N>1) */}
      {outputs.map((h, idx) => (
        <HandleStack
          key={`out-${h.id ?? idx}`}
          kind="source"
          side="tr"
          index={idx}
          total={outputs.length}
          spec={h}
        />
      ))}
    </div>
  )
}

/**
 * Empilha múltiplos handles no mesmo canto, sem colidir — desloca o
 * próximo ao longo do eixo vertical (pros cantos TR e BL).
 */
function HandleStack({
  kind,
  side,
  index,
  total,
  spec,
}: {
  kind: 'target' | 'source'
  side: 'bl' | 'tr'
  index: number
  total: number
  spec: HandleSpec
}) {
  const STEP = 26
  // quando total > 1, deslocamos; primeiro handle fica na posição do canto
  const offset = total > 1 ? index * STEP : 0

  return (
    <div
      style={{
        position: 'absolute',
        ...(side === 'bl'
          ? { bottom: 0, left: 0, marginBottom: offset }
          : { top: 0, right: 0, marginTop: offset }),
        width: 0, height: 0,
        pointerEvents: 'none',
        zIndex: 4,
      }}
    >
      <TypedHandle
        kind={kind}
        dataType={spec.dataType}
        corner={side}
        id={spec.id}
        label={spec.label}
      />
    </div>
  )
}
