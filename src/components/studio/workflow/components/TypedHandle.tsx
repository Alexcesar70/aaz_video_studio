'use client'

import React from 'react'
import { Handle, Position } from '@xyflow/react'
import type { DataType } from '../theme/nodeTypeMeta'
import { isCompatibleConnection } from '../theme/connectionRules'
import { PortIcons } from '../theme/icons'
import { wfColors } from '../theme/workflowTheme'
import { useWorkflow } from '../WorkflowContext'

/**
 * Handle tipado renderizado como círculo pequeno com ícone, posicionado
 * à LATERAL do card (não mais nos cantos TR/BL), padrão Freepik/Spaces.
 *
 * Camadas de responsabilidade (Uncle Bob):
 * - Renderização (este arquivo): visual, hitbox, posicionamento
 * - Compatibilidade (connectionRules.ts): função pura `isCompatibleConnection`
 * - Contexto de drag (WorkflowContext): estado `connecting`
 *
 * Comportamento visual:
 * - Idle: opacity 0.55, pin discreto
 * - Hover no próprio pin: opacity 1, halo
 * - Drag em andamento e pin compatível: opacity 1, cor cheia, glow
 * - Drag em andamento e pin incompatível: opacity 0.12 (apagado)
 */

export type HandleSide = 'left' | 'right'

export interface TypedHandleProps {
  /** Direção do fluxo */
  kind: 'target' | 'source'
  /** Tipo semântico — dita cor, ícone e regras de compatibilidade */
  dataType: DataType
  /** Lado do card (inputs=left, outputs=right) */
  side: HandleSide
  /** ID único dentro do nó (necessário quando há múltiplos do mesmo tipo) */
  id?: string
  /** Tooltip hover */
  label?: string
  /**
   * Posição vertical relativa ao card (0 a 1). 0.5 = centro.
   * Múltiplos handles distribuem pelo NodeFrame, que calcula essa posição.
   */
  verticalAnchor?: number
}

const PIN_SIZE = 18
const HITBOX_SIZE = 26
const GAP_FROM_CARD = 6

const DATA_TYPE_COLORS: Record<DataType, string> = {
  text: '#C6D66E',
  image: '#8B5CF6',
  video: '#06B6D4',
  prompt: '#E59866',
  any: '#9F9AB8',
}

const DATA_TYPE_PORT_ICON: Record<DataType, keyof typeof PortIcons> = {
  text: 'text',
  image: 'image',
  video: 'video',
  prompt: 'text',
  any: 'connectorOut',
}

const DATA_TYPE_LABELS: Record<DataType, string> = {
  text: 'texto',
  image: 'imagem',
  video: 'vídeo',
  prompt: 'prompt',
  any: 'qualquer',
}

export function TypedHandle({
  kind,
  dataType,
  side,
  id,
  label,
  verticalAnchor = 0.5,
}: TypedHandleProps) {
  const { connecting } = useWorkflow()
  const color = DATA_TYPE_COLORS[dataType]
  const PortIcon = PortIcons[DATA_TYPE_PORT_ICON[dataType]]

  // xyflow precisa saber de qual lado vem pra calcular curva da edge
  const xyPos = side === 'left' ? Position.Left : Position.Right

  // Estado visual — calculado puro a partir de `connecting`
  const state = resolveHandleState({
    kind,
    dataType,
    connecting,
  })

  const tooltip = label ?? `${kind === 'source' ? 'Saída' : 'Entrada'}: ${DATA_TYPE_LABELS[dataType]}`

  // Posicionamento: fora da borda do card, offset negativo.
  // Ancoragem vertical em porcentagem pra distribuir múltiplos pins.
  const sideStyle: React.CSSProperties = side === 'left'
    ? { left: -(PIN_SIZE + GAP_FROM_CARD) }
    : { right: -(PIN_SIZE + GAP_FROM_CARD) }

  return (
    <div
      title={tooltip}
      style={{
        position: 'absolute',
        top: `${verticalAnchor * 100}%`,
        transform: 'translateY(-50%)',
        width: HITBOX_SIZE,
        height: HITBOX_SIZE,
        marginLeft: side === 'left' ? -(HITBOX_SIZE - PIN_SIZE) / 2 : undefined,
        marginRight: side === 'right' ? -(HITBOX_SIZE - PIN_SIZE) / 2 : undefined,
        pointerEvents: 'none',
        zIndex: 5,
        opacity: state.opacity,
        transition: 'opacity 160ms ease',
        ...sideStyle,
      }}
    >
      {/* Handle real do xyflow — invisível, captura drag no hitbox inteiro */}
      <Handle
        type={kind}
        position={xyPos}
        id={id}
        style={{
          width: HITBOX_SIZE,
          height: HITBOX_SIZE,
          background: 'transparent',
          border: 'none',
          borderRadius: '50%',
          top: 0, left: 0, right: 'auto', bottom: 'auto',
          transform: 'none',
          pointerEvents: 'auto',
        }}
      />

      {/* Pin visível centralizado, com ícone do tipo */}
      <div
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: PIN_SIZE, height: PIN_SIZE,
          borderRadius: '50%',
          background: wfColors.surface,
          border: `1.5px solid ${color}`,
          boxShadow: state.highlight
            ? `0 0 0 3px ${color}33, 0 0 12px ${color}55`
            : `0 0 0 2px ${wfColors.canvasBase}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
          transition: 'box-shadow 160ms ease, border-color 160ms ease',
        }}
      >
        <PortIcon size={11} color={color} strokeWidth={1.75} />
      </div>
    </div>
  )
}

/**
 * Resolve estado visual do handle a partir do contexto de drag e do tipo
 * do próprio pin. Função pura — toda a lógica visual concentrada aqui.
 */
function resolveHandleState({
  kind,
  dataType,
  connecting,
}: {
  kind: 'target' | 'source'
  dataType: DataType
  connecting: { sourceDataType: DataType; sourceNodeId: string } | null
}): { opacity: number; highlight: boolean } {
  // Sem drag ativo — estado neutro, discreto mas visível
  if (!connecting) return { opacity: 0.6, highlight: false }

  // Durante drag:
  // - Sources (outputs) não são alvo, ficam neutros
  if (kind === 'source') return { opacity: 0.3, highlight: false }

  // - Targets (inputs) acendem se compatíveis com o source ativo
  const compatible = isCompatibleConnection(connecting.sourceDataType, dataType)
  return {
    opacity: compatible ? 1 : 0.12,
    highlight: compatible,
  }
}

export function getDataTypeColor(dataType: DataType): string {
  return DATA_TYPE_COLORS[dataType]
}
