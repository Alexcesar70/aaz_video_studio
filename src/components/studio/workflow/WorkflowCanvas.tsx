'use client'

import React, { useCallback, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type OnConnect,
  type NodeTypes,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { NoteNode } from './nodes/NoteNode'
import { ImageNode } from './nodes/ImageNode'
import { VideoNode } from './nodes/VideoNode'
import { ReferenceNode } from './nodes/ReferenceNode'
import { WorkflowContext, type NodeUpdatePatch } from './WorkflowContext'
import type { WorkflowNode, NodeType } from '@/modules/workflow'

const nodeTypes: NodeTypes = {
  note: NoteNode,
  image: ImageNode,
  video: VideoNode,
  reference: ReferenceNode,
}

interface WorkflowCanvasProps {
  boardId: string
  initialNodes: WorkflowNode[]
  initialConnections: Array<{ id: string; source: string; target: string }>
  onConnectionsChange?: (edges: Edge[]) => void
}

function toFlowNodes(wfNodes: WorkflowNode[]): Node[] {
  return wfNodes.map(n => ({
    id: n.id,
    type: n.type in nodeTypes ? n.type : 'note',
    position: n.position,
    data: { ...n.content, label: n.label, color: n.color },
  }))
}

function toFlowEdges(connections: Array<{ id: string; source: string; target: string }>): Edge[] {
  return connections.map(c => ({
    id: c.id,
    source: c.source,
    target: c.target,
    animated: true,
    style: { stroke: '#7F77DD', strokeWidth: 2 },
  }))
}

const TOOLBAR_ITEMS: { type: NodeType; icon: string; label: string }[] = [
  { type: 'note', icon: '📝', label: 'Nota' },
  { type: 'image', icon: '🖼️', label: 'Imagem' },
  { type: 'video', icon: '🎬', label: 'Vídeo' },
  { type: 'reference', icon: '🔗', label: 'Ref' },
]

export function WorkflowCanvas({ boardId, initialNodes, initialConnections, onConnectionsChange }: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(toFlowNodes(initialNodes))
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlowEdges(initialConnections))

  const positionTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const connectionsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const patchNode = useCallback(async (nodeId: string, body: Record<string, unknown> | NodeUpdatePatch) => {
    try {
      await fetch(`/api/workflow/boards/${boardId}/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      // silent — UI já foi atualizada
    }
  }, [boardId])

  const deleteNodeApi = useCallback(async (nodeId: string) => {
    try {
      await fetch(`/api/workflow/boards/${boardId}/nodes/${nodeId}`, { method: 'DELETE' })
    } catch {
      // silent
    }
  }, [boardId])

  const schedulePositionSave = useCallback((nodeId: string, position: { x: number; y: number }) => {
    const existing = positionTimers.current.get(nodeId)
    if (existing) clearTimeout(existing)
    const timer = setTimeout(() => {
      patchNode(nodeId, { position })
      positionTimers.current.delete(nodeId)
    }, 500)
    positionTimers.current.set(nodeId, timer)
  }, [patchNode])

  const scheduleConnectionsSave = useCallback((next: Edge[]) => {
    if (connectionsTimer.current) clearTimeout(connectionsTimer.current)
    connectionsTimer.current = setTimeout(() => {
      onConnectionsChange?.(next)
    }, 800)
  }, [onConnectionsChange])

  const updateNode = useCallback((id: string, patch: NodeUpdatePatch) => {
    setNodes(current => current.map(n => {
      if (n.id !== id) return n
      const nextData = { ...n.data }
      if (patch.content) Object.assign(nextData, patch.content)
      if (patch.label !== undefined) nextData.label = patch.label
      if (patch.color !== undefined) nextData.color = patch.color
      return { ...n, data: nextData }
    }))
    patchNode(id, patch)
  }, [patchNode, setNodes])

  const deleteNode = useCallback((id: string) => {
    setNodes(current => current.filter(n => n.id !== id))
    setEdges(current => {
      const next = current.filter(e => e.source !== id && e.target !== id)
      scheduleConnectionsSave(next)
      return next
    })
    deleteNodeApi(id)
  }, [setNodes, setEdges, scheduleConnectionsSave, deleteNodeApi])

  const contextValue = useMemo(() => ({ updateNode, deleteNode }), [updateNode, deleteNode])

  const onConnect: OnConnect = useCallback((params: Connection) => {
    setEdges(eds => {
      const newEdges = addEdge({
        ...params,
        animated: true,
        style: { stroke: '#7F77DD', strokeWidth: 2 },
      }, eds)
      scheduleConnectionsSave(newEdges)
      return newEdges
    })
  }, [setEdges, scheduleConnectionsSave])

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes)
    for (const change of changes) {
      if (change.type === 'position' && change.dragging === false && change.position) {
        schedulePositionSave(change.id, change.position)
      }
    }
  }, [onNodesChange, schedulePositionSave])

  const handleNodesDelete = useCallback((deleted: Node[]) => {
    for (const node of deleted) deleteNodeApi(node.id)
    setEdges(current => {
      const ids = new Set(deleted.map(n => n.id))
      const next = current.filter(e => !ids.has(e.source) && !ids.has(e.target))
      scheduleConnectionsSave(next)
      return next
    })
  }, [deleteNodeApi, setEdges, scheduleConnectionsSave])

  const handleEdgesDelete = useCallback((deleted: Edge[]) => {
    setEdges(current => {
      const ids = new Set(deleted.map(e => e.id))
      const next = current.filter(e => !ids.has(e.id))
      scheduleConnectionsSave(next)
      return next
    })
  }, [setEdges, scheduleConnectionsSave])

  const addNode = useCallback(async (type: NodeType) => {
    const position = { x: 200 + Math.random() * 300, y: 100 + Math.random() * 200 }
    try {
      const res = await fetch(`/api/workflow/boards/${boardId}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, position, label: '', content: {} }),
      })
      if (!res.ok) return
      const payload = await res.json() as { node: WorkflowNode }
      const created = payload.node
      const flowNode: Node = {
        id: created.id,
        type: created.type in nodeTypes ? created.type : 'note',
        position: created.position,
        data: { ...created.content, label: created.label, color: created.color },
      }
      setNodes(prev => [...prev, flowNode])
    } catch {
      // silent
    }
  }, [boardId, setNodes])

  return (
    <WorkflowContext.Provider value={contextValue}>
      <div style={{ width: '100%', height: '100%', minHeight: 500, position: 'relative' }}>
        {/* Toolbar */}
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, display: 'flex', gap: 4,
          background: '#1a1730', border: '1px solid #2A2545',
          borderRadius: 10, padding: '6px 8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {TOOLBAR_ITEMS.map(item => (
            <button
              key={item.type}
              onClick={() => addNode(item.type)}
              title={item.label}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 6,
                background: 'transparent', border: '1px solid #2A2545',
                color: '#E8E5F0', cursor: 'pointer',
                fontSize: 12, fontFamily: 'inherit',
              }}
            >
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onNodesDelete={handleNodesDelete}
          onEdgesDelete={handleEdgesDelete}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
          style={{ background: '#0A0814' }}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: '#7F77DD', strokeWidth: 2 },
          }}
        >
          <Background color="#2A2545" gap={20} size={1} />
          <Controls
            style={{ background: '#1a1730', border: '1px solid #2A2545', borderRadius: 8 }}
          />
          <MiniMap
            style={{ background: '#1a1730', border: '1px solid #2A2545', borderRadius: 8 }}
            nodeColor={() => '#7F77DD'}
            maskColor="rgba(10,8,20,0.7)"
          />
        </ReactFlow>
      </div>
    </WorkflowContext.Provider>
  )
}
