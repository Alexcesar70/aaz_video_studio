'use client'

import { createContext, useContext } from 'react'

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

export interface WorkflowContextValue {
  updateNode: (id: string, patch: NodeUpdatePatch) => void
  deleteNode: (id: string) => void
  duplicateNode: (id: string) => void
  generateImageFromPrompt: (promptNodeId: string, prompt: string, count?: number) => Promise<GenerateImageResult>
}

const noop = () => {}

export const WorkflowContext = createContext<WorkflowContextValue>({
  updateNode: noop,
  deleteNode: noop,
  duplicateNode: noop,
  generateImageFromPrompt: async () => ({ ok: false, error: 'Canvas não inicializado.' }),
})

export function useWorkflow() {
  return useContext(WorkflowContext)
}
