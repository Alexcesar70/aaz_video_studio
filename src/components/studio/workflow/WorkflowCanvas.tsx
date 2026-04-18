'use client'

import React, { useState, useCallback, useRef } from 'react'
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
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { NoteNode } from './nodes/NoteNode'
import { ImageNode } from './nodes/ImageNode'
import { VideoNode } from './nodes/VideoNode'
import { ReferenceNode } from './nodes/ReferenceNode'
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
  onSave?: (nodes: Node[], edges: Edge[]) => void
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

export function WorkflowCanvas({ boardId, initialNodes, initialConnections, onSave }: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(toFlowNodes(initialNodes))
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlowEdges(initialConnections))
  const saveTimer = useRef<NodeJS.Timeout | null>(null)

  const debouncedSave = useCallback((n: Node[], e: Edge[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => onSave?.(n, e), 1000)
  }, [onSave])

  const onConnect: OnConnect = useCallback((params: Connection) => {
    setEdges(eds => {
      const newEdges = addEdge({
        ...params,
        animated: true,
        style: { stroke: '#7F77DD', strokeWidth: 2 },
      }, eds)
      debouncedSave(nodes, newEdges)
      return newEdges
    })
  }, [setEdges, nodes, debouncedSave])

  const handleNodesChange: typeof onNodesChange = useCallback((changes) => {
    onNodesChange(changes)
    if (changes.some(c => c.type === 'position' || c.type === 'remove')) {
      setTimeout(() => {
        setNodes(current => {
          debouncedSave(current, edges)
          return current
        })
      }, 0)
    }
  }, [onNodesChange, edges, debouncedSave, setNodes])

  const addNode = useCallback((type: NodeType) => {
    const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const newNode: Node = {
      id,
      type: type in nodeTypes ? type : 'note',
      position: { x: 200 + Math.random() * 300, y: 100 + Math.random() * 200 },
      data: { label: '', text: '' },
    }
    setNodes(prev => {
      const updated = [...prev, newNode]
      debouncedSave(updated, edges)
      return updated
    })

    fetch(`/api/workflow/boards/${boardId}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, position: newNode.position, label: '', content: {} }),
    }).catch(() => {})
  }, [boardId, edges, debouncedSave, setNodes])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
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
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
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
  )
}
