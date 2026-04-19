'use client'

import React from 'react'
import { Handle, Position, useNodeId } from '@xyflow/react'
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
  audio: '#F472B6',
  prompt: '#E59866',
  any: '#9F9AB8',
}

const DATA_TYPE_PORT_ICON: Record<DataType, keyof typeof PortIcons> = {
  text: 'text',
  image: 'image',
  video: 'video',
  audio: 'audio',
  prompt: 'text',
  any: 'connectorOut',
}

const DATA_TYPE_LABELS: Record<DataType, string> = {
  text: 'texto',
  image: 'imagem',
  video: 'vídeo',
  audio: 'áudio',
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
  const { connecting, selectedNodeId, selectedOutputType, selectedInputTypes } = useWorkflow()
  const myNodeId = useNodeId()
  const color = DATA_TYPE_COLORS[dataType]
  const PortIcon = PortIcons[DATA_TYPE_PORT_ICON[dataType]]

  // xyflow precisa saber de qual lado vem pra calcular curva da edge
  const xyPos = side === 'left' ? Position.Left : Position.Right

  // Estado visual — 4 fases, ordem de prioridade: drag > seleção > idle
  const state = resolveHandleState({
    kind,
    dataType,
    connecting,
    selectedNodeId,
    selectedOutputType,
    selectedInputTypes,
    myNodeId,
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
      {/* Handle real do xyflow — invisível, captura drag no hitbox inteiro.
          title= aciona o tooltip nativo do browser (estável, espera user ler). */}
      <Handle
        type={kind}
        position={xyPos}
        id={id}
        title={tooltip}
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
/**
 * 4 fases de destaque, ordem de prioridade (drag > seleção > idle):
 *
 * 1. DRAG ATIVO (connecting): user está arrastando cabo — inputs
 *    compatíveis com o source acendem cor cheia, incompatíveis quase
 *    somem. Outputs (source) ficam neutros.
 *
 * 2. HANDLE DO NÓ SELECIONADO: o próprio nó clicado tem TODOS os pins
 *    bem visíveis (mostra a "capacidade" do nó: quais ports ele tem).
 *
 * 3. HANDLE DE OUTRO NÓ + há nó selecionado: destaque BIDIRECIONAL —
 *    a) kind=target: compatível se o OUTPUT do selecionado alimenta
 *       este input (fluxo "onde posso mandar")
 *    b) kind=source: compatível se este output alimenta algum INPUT
 *       do selecionado (fluxo "de onde posso receber")
 *    Incompatíveis ficam atenuados.
 *
 * 4. IDLE: sem drag nem seleção — neutro discreto.
 */
function resolveHandleState({
  kind,
  dataType,
  connecting,
  selectedNodeId,
  selectedOutputType,
  selectedInputTypes,
  myNodeId,
}: {
  kind: 'target' | 'source'
  dataType: DataType
  connecting: { sourceDataType: DataType; sourceNodeId: string } | null
  selectedNodeId: string | null
  selectedOutputType: DataType | null
  selectedInputTypes: DataType[] | null
  myNodeId: string | null
}): { opacity: number; highlight: boolean } {
  // Fase 1: durante drag ativo
  if (connecting) {
    if (kind === 'source') return { opacity: 0.3, highlight: false }
    const compatible = isCompatibleConnection(connecting.sourceDataType, dataType)
    return {
      opacity: compatible ? 1 : 0.12,
      highlight: compatible,
    }
  }

  // Fase 2: este handle pertence ao nó selecionado
  if (selectedNodeId && myNodeId === selectedNodeId) {
    return { opacity: 0.95, highlight: true }
  }

  // Fase 3: há OUTRO nó selecionado — destaque bidirecional
  if (selectedNodeId) {
    let compatible = false

    // a) "onde posso mandar" — meu output do selected vai pra input deste
    if (kind === 'target' && selectedOutputType) {
      compatible = isCompatibleConnection(selectedOutputType, dataType)
    }
    // b) "de onde posso receber" — output deste vai pra algum input do selected
    if (!compatible && kind === 'source' && selectedInputTypes) {
      compatible = selectedInputTypes.some(t => isCompatibleConnection(dataType, t))
    }

    return {
      opacity: compatible ? 0.95 : 0.25,
      highlight: compatible,
    }
  }

  // Fase 4: idle
  return { opacity: 0.6, highlight: false }
}

export function getDataTypeColor(dataType: DataType): string {
  return DATA_TYPE_COLORS[dataType]
}
