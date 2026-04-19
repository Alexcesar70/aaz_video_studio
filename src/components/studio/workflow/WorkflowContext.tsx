'use client'

import { createContext, useContext } from 'react'
import type { DataType } from './theme/nodeTypeMeta'

export interface NodeUpdatePatch {
  content?: Record<string, unknown>
  label?: string
  color?: string
}

export interface GenerateImageResult {
  ok: boolean
  error?: string
  imageNodeIds?: string[]
}

/**
 * Estado de drag de conexão em andamento. Quando user inicia drag de um
 * handle, registramos o tipo do source aqui — consumidores (TypedHandle)
 * usam pra colorir pins compatíveis em destaque e esmaecer incompatíveis.
 */
export interface ConnectingState {
  sourceDataType: DataType
  sourceNodeId: string
}

export interface WorkflowContextValue {
  updateNode: (id: string, patch: NodeUpdatePatch) => void
  deleteNode: (id: string) => void
  duplicateNode: (id: string) => void
  generateImageFromPrompt: (promptNodeId: string, prompt: string, count?: number) => Promise<GenerateImageResult>
  /** Estado da conexão em drag — null quando idle. */
  connecting: ConnectingState | null
  /**
   * ID do nó atualmente selecionado (se houver). Usado pra identificar
   * quando um handle pertence ao "próprio nó" (destaca todos os pins
   * dele pra mostrar capacidade ao user).
   */
  selectedNodeId: string | null
  /**
   * Output type do nó selecionado. Usado pra destacar inputs
   * compatíveis em OUTROS nós (direção "onde posso mandar").
   */
  selectedOutputType: DataType | null
  /**
   * Input types aceitos pelo nó selecionado. Usado pra destacar
   * outputs compatíveis em OUTROS nós (direção "de onde posso receber").
   */
  selectedInputTypes: DataType[] | null
}

const noop = () => {}

export const WorkflowContext = createContext<WorkflowContextValue>({
  updateNode: noop,
  deleteNode: noop,
  duplicateNode: noop,
  generateImageFromPrompt: async () => ({ ok: false, error: 'Canvas não inicializado.' }),
  connecting: null,
  selectedNodeId: null,
  selectedOutputType: null,
  selectedInputTypes: null,
})

export function useWorkflow() {
  return useContext(WorkflowContext)
}
