'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
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
import { CharacterNode } from './nodes/CharacterNode'
import { ScenarioNode } from './nodes/ScenarioNode'
import { PromptNode } from './nodes/PromptNode'
import { WorkflowContext, type NodeUpdatePatch, type GenerateImageResult } from './WorkflowContext'
import { NodeContextMenu, type ContextMenuState } from './NodeContextMenu'
import { getDataTypeColor } from './components/TypedHandle'
import { wfCanvasBackground, wfColors, wfGridColor, wfGridGap, wfRadius, wfShadow } from './theme/workflowTheme'
import { getNodeTypeMeta } from './theme/nodeTypeMeta'
import { getNodeTypeIcon, DEFAULT_ICON_PROPS } from './theme/icons'
import type { DraggableItem } from './WorkflowSidebar'
import type { WorkflowNode, NodeType } from '@/modules/workflow'

const nodeTypes: NodeTypes = {
  note: NoteNode,
  image: ImageNode,
  video: VideoNode,
  reference: ReferenceNode,
  character: CharacterNode,
  scenario: ScenarioNode,
  prompt: PromptNode,
}

export type SaveStatus = 'idle' | 'saving' | 'saved'

interface WorkflowCanvasProps {
  boardId: string
  initialNodes: WorkflowNode[]
  initialConnections: Array<{ id: string; source: string; target: string }>
  onConnectionsChange?: (edges: Edge[]) => void
  onSaveStatusChange?: (status: SaveStatus) => void
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

const TOOLBAR_ITEMS: { type: NodeType; label: string }[] = [
  { type: 'note', label: 'Nota' },
  { type: 'prompt', label: 'Prompt' },
  { type: 'image', label: 'Imagem' },
  { type: 'video', label: 'Vídeo' },
  { type: 'reference', label: 'Ref' },
]

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  )
}

function WorkflowCanvasInner({ boardId, initialNodes, initialConnections, onConnectionsChange, onSaveStatusChange }: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(toFlowNodes(initialNodes))
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlowEdges(initialConnections))
  const { screenToFlowPosition, getNode } = useReactFlow()

  const positionTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const connectionsTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingOps = useRef(0)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const beginSave = useCallback(() => {
    pendingOps.current += 1
    onSaveStatusChange?.('saving')
    if (savedTimer.current) {
      clearTimeout(savedTimer.current)
      savedTimer.current = null
    }
  }, [onSaveStatusChange])

  const endSave = useCallback(() => {
    pendingOps.current = Math.max(0, pendingOps.current - 1)
    if (pendingOps.current === 0) {
      onSaveStatusChange?.('saved')
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => onSaveStatusChange?.('idle'), 2000)
    }
  }, [onSaveStatusChange])

  const patchNode = useCallback(async (nodeId: string, body: Record<string, unknown> | NodeUpdatePatch) => {
    beginSave()
    try {
      await fetch(`/api/workflow/boards/${boardId}/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      // silent — UI já foi atualizada
    } finally {
      endSave()
    }
  }, [boardId, beginSave, endSave])

  const deleteNodeApi = useCallback(async (nodeId: string) => {
    beginSave()
    try {
      await fetch(`/api/workflow/boards/${boardId}/nodes/${nodeId}`, { method: 'DELETE' })
    } catch {
      // silent
    } finally {
      endSave()
    }
  }, [boardId, beginSave, endSave])

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
    connectionsTimer.current = setTimeout(async () => {
      beginSave()
      try {
        await onConnectionsChange?.(next)
      } finally {
        endSave()
      }
    }, 800)
  }, [onConnectionsChange, beginSave, endSave])

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

  const createNodeAt = useCallback(async (
    type: NodeType,
    position: { x: number; y: number },
    label = '',
    content: Record<string, unknown> = {},
  ): Promise<Node | null> => {
    beginSave()
    try {
      const res = await fetch(`/api/workflow/boards/${boardId}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, position, label, content }),
      })
      if (!res.ok) return null
      const payload = await res.json() as { node: WorkflowNode }
      const created = payload.node
      const flowNode: Node = {
        id: created.id,
        type: created.type in nodeTypes ? created.type : 'note',
        position: created.position,
        data: { ...created.content, label: created.label, color: created.color },
      }
      setNodes(prev => [...prev, flowNode])
      return flowNode
    } catch {
      return null
    } finally {
      endSave()
    }
  }, [boardId, setNodes, beginSave, endSave])

  const generateImageFromPrompt = useCallback(async (
    promptNodeId: string,
    prompt: string,
    count: number = 1,
  ): Promise<GenerateImageResult> => {
    const trimmed = prompt.trim()
    if (!trimmed) return { ok: false, error: 'Prompt vazio.' }

    const promptNode = getNode(promptNodeId)
    const basePos = promptNode?.position ?? { x: 0, y: 0 }
    const safeCount = Math.max(1, Math.min(count, 4))

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed, num_outputs: safeCount }),
      })
      const data = await res.json() as { imageUrls?: string[]; error?: string }
      if (!res.ok) return { ok: false, error: data.error ?? 'Falha ao gerar.' }
      const urls = data.imageUrls ?? []
      if (urls.length === 0) return { ok: false, error: 'Sem imagem retornada.' }

      const createdIds: string[] = []
      for (let i = 0; i < urls.length; i++) {
        const pos = { x: basePos.x + 320, y: basePos.y + i * 220 }
        const node = await createNodeAt('image', pos, '', { url: urls[i], sourcePrompt: trimmed })
        if (node) createdIds.push(node.id)
      }

      if (createdIds.length === 0) return { ok: false, error: 'Falha ao criar nós.' }

      const newEdges: Edge[] = createdIds.map(targetId => ({
        id: `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${targetId}`,
        source: promptNodeId,
        target: targetId,
        animated: true,
        style: { stroke: '#7F77DD', strokeWidth: 2 },
      }))
      setEdges(current => {
        const next = [...current, ...newEdges]
        scheduleConnectionsSave(next)
        return next
      })

      return { ok: true, imageNodeIds: createdIds }
    } catch {
      return { ok: false, error: 'Erro de conexão.' }
    }
  }, [getNode, createNodeAt, setEdges, scheduleConnectionsSave])

  const duplicateNode = useCallback((id: string) => {
    const node = getNode(id)
    if (!node) return
    const nodeType = (node.type ?? 'note') as NodeType
    const offset = { x: node.position.x + 40, y: node.position.y + 40 }
    const data = node.data as Record<string, unknown>
    const { label: labelData, color: colorData, ...contentRest } = data
    createNodeAt(
      nodeType,
      offset,
      typeof labelData === 'string' ? labelData : '',
      contentRest,
    )
  }, [getNode, createNodeAt])

  const contextValue = useMemo(
    () => ({ updateNode, deleteNode, duplicateNode, generateImageFromPrompt }),
    [updateNode, deleteNode, duplicateNode, generateImageFromPrompt],
  )

  const getEdgeColorFromSource = useCallback((sourceNodeId: string): string => {
    const node = getNode(sourceNodeId)
    if (!node) return wfColors.edgeDefault
    const meta = getNodeTypeMeta((node.type ?? 'note') as NodeType)
    return getDataTypeColor(meta.outputType ?? 'any')
  }, [getNode])

  const onConnect: OnConnect = useCallback((params: Connection) => {
    const color = params.source ? getEdgeColorFromSource(params.source) : wfColors.edgeDefault
    setEdges(eds => {
      const newEdges = addEdge({
        ...params,
        animated: false,
        style: { stroke: color, strokeWidth: 2 },
      }, eds)
      scheduleConnectionsSave(newEdges)
      return newEdges
    })
  }, [setEdges, scheduleConnectionsSave, getEdgeColorFromSource])

  // Repinta edges existentes pela cor do source output — roda quando
  // nodes carregam/mudam. Skip se a cor já bate.
  useEffect(() => {
    if (nodes.length === 0) return
    setEdges(curr => {
      let changed = false
      const next = curr.map(e => {
        const src = nodes.find(n => n.id === e.source)
        if (!src) return e
        const meta = getNodeTypeMeta((src.type ?? 'note') as NodeType)
        const color = getDataTypeColor(meta.outputType ?? 'any')
        const currentStroke = (e.style as { stroke?: string } | undefined)?.stroke
        if (currentStroke === color && !e.animated) return e
        changed = true
        return { ...e, style: { ...e.style, stroke: color, strokeWidth: 2 }, animated: false }
      })
      return changed ? next : curr
    })
  }, [nodes, setEdges])

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

  const addNode = useCallback((type: NodeType) => {
    const position = { x: 200 + Math.random() * 300, y: 100 + Math.random() * 200 }
    createNodeAt(type, position)
  }, [createNodeAt])

  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      const isEditable = ev.target instanceof HTMLElement
        && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA' || ev.target.isContentEditable)
      if (isEditable) return

      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'd') {
        ev.preventDefault()
        const selected = nodes.filter(n => n.selected)
        for (const n of selected) duplicateNode(n.id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nodes, duplicateNode])

  const onDragOver = useCallback((ev: React.DragEvent) => {
    ev.preventDefault()
    ev.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback((ev: React.DragEvent) => {
    ev.preventDefault()
    const raw = ev.dataTransfer.getData('application/workflow-item')
    if (!raw) return
    let item: DraggableItem
    try {
      item = JSON.parse(raw) as DraggableItem
    } catch {
      return
    }
    const position = screenToFlowPosition({ x: ev.clientX, y: ev.clientY })
    const type: NodeType = item.kind === 'character' ? 'character' : 'scenario'
    createNodeAt(type, position, item.label, item.content)
  }, [screenToFlowPosition, createNodeAt])

  return (
    <WorkflowContext.Provider value={contextValue}>
      <div
        style={{ width: '100%', height: '100%', minHeight: 500, position: 'relative' }}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {/* Toolbar */}
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, display: 'flex', gap: 4,
          background: wfColors.surface, border: `1px solid ${wfColors.border}`,
          borderRadius: wfRadius.card, padding: '6px 8px',
          boxShadow: wfShadow.toolbar,
          backdropFilter: 'blur(6px)',
        }}>
          {TOOLBAR_ITEMS.map(item => {
            const meta = getNodeTypeMeta(item.type)
            const Icon = getNodeTypeIcon(item.type)
            return (
              <button
                key={item.type}
                onClick={() => addNode(item.type)}
                title={item.label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', borderRadius: wfRadius.control,
                  background: 'transparent', border: `1px solid ${wfColors.border}`,
                  color: wfColors.text, cursor: 'pointer',
                  fontSize: 11, fontFamily: 'inherit',
                }}
              >
                <Icon size={13} color={meta.color} {...DEFAULT_ICON_PROPS} />
                {item.label}
              </button>
            )
          })}
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onNodesDelete={handleNodesDelete}
          onEdgesDelete={handleEdgesDelete}
          onConnect={onConnect}
          onNodeContextMenu={(ev, node) => {
            ev.preventDefault()
            setContextMenu({ nodeId: node.id, x: ev.clientX, y: ev.clientY })
          }}
          onPaneClick={() => setContextMenu(null)}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
          minZoom={0.25}
          maxZoom={2}
          deleteKeyCode={['Backspace', 'Delete']}
          style={{ background: wfCanvasBackground }}
          defaultEdgeOptions={{
            animated: false,
            style: { stroke: wfColors.edgeDefault, strokeWidth: 2 },
          }}
          connectionLineStyle={{
            stroke: wfColors.textDim,
            strokeWidth: 1.5,
            strokeDasharray: '5 4',
          }}
        >
          <Background color={wfGridColor} gap={wfGridGap} size={1} />
          <Controls
            showInteractive={false}
            style={{
              background: wfColors.surface,
              border: `1px solid ${wfColors.border}`,
              borderRadius: wfRadius.inner,
              boxShadow: wfShadow.card,
              opacity: 0.85,
            }}
          />
        </ReactFlow>
      </div>
      {contextMenu && (
        <NodeContextMenu state={contextMenu} onClose={() => setContextMenu(null)} />
      )}
    </WorkflowContext.Provider>
  )
}
