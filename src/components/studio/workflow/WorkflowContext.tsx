'use client'

import { createContext, useContext } from 'react'

export interface NodeUpdatePatch {
  content?: Record<string, unknown>
  label?: string
  color?: string
}

export interface WorkflowContextValue {
  updateNode: (id: string, patch: NodeUpdatePatch) => void
  deleteNode: (id: string) => void
}

const noop = () => {}

export const WorkflowContext = createContext<WorkflowContextValue>({
  updateNode: noop,
  deleteNode: noop,
})

export function useWorkflow() {
  return useContext(WorkflowContext)
}
