'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { C } from '@/components/studio/theme'
import { WorkflowCanvas, type SaveStatus } from '@/components/studio/workflow/WorkflowCanvas'
import { WorkflowSidebar } from '@/components/studio/workflow/WorkflowSidebar'
import { NavIcons, UIIcons, DEFAULT_ICON_PROPS } from '@/components/studio/workflow/theme/icons'
import type { Board } from '@/modules/workflow'
import type { Edge } from '@xyflow/react'

export default function BoardPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [board, setBoard] = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [libraryOpen, setLibraryOpen] = useState(false)

  useEffect(() => {
    fetch(`/api/workflow/boards/${params.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setBoard(data?.board ?? null))
      .finally(() => setLoading(false))
  }, [params.id])

  // Shortcut L — toggle biblioteca (não dispara em inputs/textareas)
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null
      const editable = target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )
      if (editable) return
      if (ev.key.toLowerCase() === 'l' && !ev.metaKey && !ev.ctrlKey && !ev.altKey) {
        ev.preventDefault()
        setLibraryOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleConnectionsChange = useCallback(async (edges: Edge[]) => {
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

  const saveName = useCallback(async () => {
    setEditingName(false)
    if (!board) return
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === board.name) return
    setBoard({ ...board, name: trimmed })
    await fetch(`/api/workflow/boards/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    }).catch(() => {})
  }, [board, nameDraft, params.id])

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
          <button
            onClick={() => router.push('/workflow')}
            title="Voltar"
            style={{
              background: 'transparent', border: 'none', color: C.textDim,
              cursor: 'pointer', padding: 2, display: 'inline-flex', alignItems: 'center',
            }}
          >
            <UIIcons.chevronLeft size={16} {...DEFAULT_ICON_PROPS} style={{ transform: 'rotate(90deg)' }} />
          </button>
          <button
            onClick={() => setLibraryOpen(o => !o)}
            title="Biblioteca (L)"
            style={{
              background: libraryOpen ? `${C.purple}25` : 'transparent',
              border: `1px solid ${libraryOpen ? C.purple : 'transparent'}`,
              color: libraryOpen ? C.text : C.textDim,
              cursor: 'pointer', padding: '4px 6px', borderRadius: 6,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontFamily: 'inherit',
              transition: 'all 120ms ease',
            }}
          >
            <NavIcons.assets size={14} {...DEFAULT_ICON_PROPS} />
          </button>
          {editingName ? (
            <input
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => {
                if (e.key === 'Enter') saveName()
                if (e.key === 'Escape') setEditingName(false)
              }}
              autoFocus
              style={{
                fontSize: 14, fontWeight: 700, color: C.text,
                background: '#0f0d1a', border: `1px solid ${C.border}`,
                borderRadius: 4, padding: '2px 6px', outline: 'none',
                fontFamily: 'inherit', minWidth: 200,
              }}
            />
          ) : (
            <span
              onDoubleClick={() => { setNameDraft(board.name); setEditingName(true) }}
              title="Double-click para renomear"
              style={{ fontSize: 14, fontWeight: 700, color: C.text, cursor: 'text' }}
            >
              {board.name}
            </span>
          )}
          <span style={{ fontSize: 11, color: C.textDim }}>{board.nodes.length} nós</span>
        </div>
        <SaveIndicator status={saveStatus} />
      </div>

      {/* Canvas full width + drawer sobreposto */}
      <div style={{ flex: 1, minHeight: 0, height: 'calc(100vh - 50px)', position: 'relative' }}>
        <WorkflowCanvas
          boardId={board.id}
          initialNodes={board.nodes}
          initialConnections={board.connections}
          onConnectionsChange={handleConnectionsChange}
          onSaveStatusChange={setSaveStatus}
        />
        <WorkflowSidebar open={libraryOpen} onClose={() => setLibraryOpen(false)} />
      </div>
    </div>
  )
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const meta = {
    idle: { color: C.textDim, text: 'Auto-save ativo', icon: '•' },
    saving: { color: '#E5B87A', text: 'Salvando...', icon: '⏳' },
    saved: { color: '#5DCAA5', text: 'Salvo', icon: '✓' },
  }[status]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: meta.color }}>
      <span>{meta.icon}</span>
      <span>{meta.text}</span>
    </div>
  )
}
