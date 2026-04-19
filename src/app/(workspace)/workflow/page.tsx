'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { C } from '@/components/studio/theme'
import { NavIcons, DEFAULT_ICON_PROPS } from '@/components/studio/workflow/theme/icons'

interface BoardSummary {
  id: string
  name: string
  nodesCount: number
  connectionsCount: number
  createdAt: string
  updatedAt: string
}

export default function WorkflowPage() {
  const router = useRouter()
  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    fetch('/api/workflow/boards')
      .then(r => r.ok ? r.json() : { boards: [] })
      .then(data => setBoards(data.boards ?? []))
      .finally(() => setLoading(false))
  }, [])

  const createBoard = async () => {
    if (!newName.trim()) return
    setCreating(true)
    const res = await fetch('/api/workflow/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    const data = await res.json()
    if (data.ok && data.board) {
      router.push(`/workflow/${data.board.id}`)
    }
    setCreating(false)
  }

  return (
    <div style={{ padding: '32px', color: C.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Workflow</h1>
          <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>Canvas visual pra planejar e organizar produção</p>
        </div>
      </div>

      {/* Create new */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 24,
        padding: '12px 16px', background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 10,
      }}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createBoard()}
          placeholder="Nome do novo board..."
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8,
            background: C.surface, border: `1px solid ${C.border}`,
            color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button
          onClick={createBoard}
          disabled={!newName.trim() || creating}
          style={{
            padding: '8px 20px', borderRadius: 8,
            background: newName.trim() ? C.purple : C.surface,
            border: 'none', color: newName.trim() ? '#fff' : C.textDim,
            fontSize: 13, fontWeight: 600, cursor: newName.trim() ? 'pointer' : 'default',
            fontFamily: 'inherit',
          }}
        >
          + Criar Board
        </button>
      </div>

      {/* Board list */}
      {loading ? (
        <div style={{ color: C.textDim, padding: 40, textAlign: 'center' }}>Carregando...</div>
      ) : boards.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center', color: C.textDim }}>
            <NavIcons.workflow size={40} {...DEFAULT_ICON_PROPS} strokeWidth={1.25} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Nenhum board ainda</div>
          <div style={{ fontSize: 13, color: C.textDim }}>Crie seu primeiro board pra organizar referências, cenas e assets visualmente.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {boards.map(b => (
            <button
              key={b.id}
              onClick={() => router.push(`/workflow/${b.id}`)}
              style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                padding: '20px', cursor: 'pointer', textAlign: 'left',
                fontFamily: 'inherit', transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = C.purple)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 8 }}>{b.name}</div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: C.textDim }}>
                <span>{b.nodesCount} nós</span>
                <span>{b.connectionsCount} conexões</span>
              </div>
              <div style={{ fontSize: 10, color: C.textDim, marginTop: 8 }}>
                Atualizado {new Date(b.updatedAt).toLocaleDateString('pt-BR')}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
