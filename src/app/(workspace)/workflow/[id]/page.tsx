'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { C } from '@/components/studio/theme'
import { WorkflowCanvas } from '@/components/studio/workflow/WorkflowCanvas'
import type { Board } from '@/modules/workflow'
import type { Node, Edge } from '@xyflow/react'

export default function BoardPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [board, setBoard] = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/workflow/boards/${params.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setBoard(data?.board ?? null))
      .finally(() => setLoading(false))
  }, [params.id])

  const handleSave = useCallback(async (nodes: Node[], edges: Edge[]) => {
    const connections = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
    }))
    await fetch(`/api/workflow/boards/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connections }),
    }).catch(() => {})
  }, [params.id])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: C.textDim }}>
        Carregando board...
      </div>
    )
  }

  if (!board) {
    return (
      <div style={{ padding: 32, color: C.text }}>
        <button onClick={() => router.push('/workflow')} style={{ background: 'transparent', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', marginBottom: 16 }}>
          ← Voltar
        </button>
        <div style={{ textAlign: 'center', padding: '60px', color: C.textDim }}>Board não encontrado.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 0px)' }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push('/workflow')} style={{ background: 'transparent', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 14 }}>←</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{board.name}</span>
          <span style={{ fontSize: 11, color: C.textDim }}>{board.nodes.length} nós</span>
        </div>
        <div style={{ fontSize: 10, color: C.textDim }}>
          auto-save ativo
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, minHeight: 0, height: 'calc(100vh - 50px)' }}>
        <WorkflowCanvas
          boardId={board.id}
          initialNodes={board.nodes}
          initialConnections={board.connections}
          onSave={handleSave}
        />
      </div>
    </div>
  )
}
