export type NodeType = 'note' | 'image' | 'video' | 'character' | 'scenario' | 'reference' | 'prompt' | 'smart-prompter' | 'assistant' | 'list' | 'audio' | 'group' | 'task'

export interface NodePosition {
  x: number
  y: number
}

export interface NodeSize {
  width: number
  height: number
}

export interface WorkflowNode {
  id: string
  type: NodeType
  position: NodePosition
  size: NodeSize
  content: Record<string, unknown>
  label?: string
  color?: string
  parentGroupId?: string
  assignedTo?: string
  status?: 'pending' | 'in_progress' | 'ready' | 'approved'
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface Connection {
  id: string
  source: string
  target: string
  label?: string
}

export interface BoardViewport {
  x: number
  y: number
  zoom: number
}

export interface Board {
  id: string
  name: string
  workspaceId: string
  nodes: WorkflowNode[]
  connections: Connection[]
  viewport: BoardViewport
  createdBy: string
  createdAt: string
  updatedAt: string
}

export function createBoard(params: {
  name: string
  workspaceId: string
  createdBy: string
}): Board {
  const now = new Date().toISOString()
  return {
    id: `board_${Date.now()}`,
    name: params.name,
    workspaceId: params.workspaceId,
    nodes: [],
    connections: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  }
}

export function createNode(params: {
  type: NodeType
  position: NodePosition
  content?: Record<string, unknown>
  label?: string
  color?: string
  createdBy: string
}): WorkflowNode {
  const now = new Date().toISOString()
  return {
    id: `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: params.type,
    position: params.position,
    size: { width: 200, height: 120 },
    content: params.content ?? {},
    label: params.label,
    color: params.color,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  }
}
