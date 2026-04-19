'use client'

import React from 'react'
import { Handle, Position } from '@xyflow/react'
import type { DataType } from '../theme/nodeTypeMeta'
import { PortIcons } from '../theme/icons'
import { wfColors } from '../theme/workflowTheme'

/**
 * Handle tipado com:
 * - Hitbox generoso (22×22 transparente) pra facilitar drag de conexão
 * - Pin visível pequeno (10×10) com cor do tipo de dado
 * - Ícone da porta correspondente ao DataType (do Bear Icon Kit)
 * - Posicionamento absoluto em cantos (TR pra outputs, BL pra inputs
 *   — padrão Freepik/Spaces)
 *
 * Compõe <Handle> do xyflow mantendo sua semântica (target/source) +
 * overlay visual próprio.
 */

export type HandleCorner = 'tl' | 'tr' | 'bl' | 'br'

export interface TypedHandleProps {
  /** Direção do fluxo — target (input) ou source (output) */
  kind: 'target' | 'source'
  /** Tipo semântico do dado que entra/sai — dita cor e ícone */
  dataType: DataType
  /** Canto do card em que o handle é renderizado */
  corner: HandleCorner
  /** ID único dentro do nó (necessário quando há múltiplos handles do mesmo tipo) */
  id?: string
  /** Tooltip hover — ex: "Entrada: texto" */
  label?: string
  /** Sobrescreve cor default do dataType */
  color?: string
}

const PIN_SIZE = 10
const HITBOX_SIZE = 22

const DATA_TYPE_COLORS: Record<DataType, string> = {
  text: '#C6D66E',   // verde-oliva (cor da Nota)
  image: '#8B5CF6',  // roxo
  video: '#06B6D4',  // ciano
  prompt: '#E59866', // âmbar
  any: '#9F9AB8',    // neutro
}

const DATA_TYPE_PORT_ICON: Record<DataType, keyof typeof PortIcons> = {
  text: 'text',
  image: 'image',
  video: 'video',
  prompt: 'text',  // prompt é texto; usa port-text
  any: 'connectorOut',
}

function getCornerStyle(corner: HandleCorner): React.CSSProperties {
  // offset negativo = fora da borda do card
  const offset = -HITBOX_SIZE / 2
  switch (corner) {
    case 'tl': return { top: offset, left: offset }
    case 'tr': return { top: offset, right: offset }
    case 'bl': return { bottom: offset, left: offset }
    case 'br': return { bottom: offset, right: offset }
  }
}

function getXyflowPosition(corner: HandleCorner): Position {
  // xyflow precisa saber de qual lado a edge vai sair/entrar pra calcular
  // a curva. Usamos Top pra TR/TL e Bottom pra BR/BL.
  if (corner === 'tr' || corner === 'tl') return Position.Top
  return Position.Bottom
}

export function TypedHandle({
  kind,
  dataType,
  corner,
  id,
  label,
  color: colorOverride,
}: TypedHandleProps) {
  const color = colorOverride ?? DATA_TYPE_COLORS[dataType]
  const xyPos = getXyflowPosition(corner)
  const cornerStyle = getCornerStyle(corner)
  const PortIcon = PortIcons[DATA_TYPE_PORT_ICON[dataType]]

  const tooltip = label ?? `${kind === 'source' ? 'Saída' : 'Entrada'}: ${DATA_TYPE_LABELS[dataType]}`

  return (
    <div
      title={tooltip}
      style={{
        position: 'absolute',
        width: HITBOX_SIZE,
        height: HITBOX_SIZE,
        pointerEvents: 'none', // hitbox delegado ao <Handle>
        zIndex: 4,
        ...cornerStyle,
      }}
    >
      {/* Handle real do xyflow — invisível mas captura drag */}
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
      {/* Pin visível centralizado */}
      <div
        style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: PIN_SIZE, height: PIN_SIZE,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 0 2px ${wfColors.surface}, 0 0 0 3px ${color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
          transition: 'transform 120ms ease, box-shadow 120ms ease',
        }}
        data-port-color={color}
        data-port-kind={kind}
      >
        <PortIcon size={6} color="#0A0814" strokeWidth={2} />
      </div>
    </div>
  )
}

const DATA_TYPE_LABELS: Record<DataType, string> = {
  text: 'texto',
  image: 'imagem',
  video: 'vídeo',
  prompt: 'prompt',
  any: 'qualquer',
}

/** Exportado pra que o canvas possa colorir edges conforme o source handle. */
export function getDataTypeColor(dataType: DataType): string {
  return DATA_TYPE_COLORS[dataType]
}
