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
   * Tipo de saída do nó atualmente selecionado (se houver). Usado pra
   * destacar pins compatíveis de outros nós quando o usuário CLICA num
   * nó (discoverability — "onde posso mandar esse output?"). null quando
   * nada está selecionado ou o nó selecionado não tem output tipado.
   */
  selectedOutputType: DataType | null
}

const noop = () => {}

export const WorkflowContext = createContext<WorkflowContextValue>({
  updateNode: noop,
  deleteNode: noop,
  duplicateNode: noop,
  generateImageFromPrompt: async () => ({ ok: false, error: 'Canvas não inicializado.' }),
  connecting: null,
  selectedOutputType: null,
})

export function useWorkflow() {
  return useContext(WorkflowContext)
}
