'use client'

import React, { useEffect, useRef, useState } from 'react'
import { wfColors, wfRadius, wfShadow } from './theme/workflowTheme'
import { NODE_TYPE_ICONS, UIIcons, DEFAULT_ICON_PROPS } from './theme/icons'

export interface DraggableItem {
  kind: 'character' | 'scenario'
  content: Record<string, unknown>
  label: string
}

interface CharacterEntry {
  charId: string
  name: string
  emoji: string
  sheetUrl: string
  photos: number
}

interface ScenarioEntry {
  id: string
  name: string
  imageUrl: string
}

type TabKey = 'characters' | 'scenarios'

export interface WorkflowSidebarProps {
  /** Controla visibilidade. Default: fechado. */
  open: boolean
  /** Chamado quando o usuário clica fora, aperta ESC ou no ícone de fechar. */
  onClose: () => void
}

/**
 * Drawer flutuante sobreposto (não empurra o canvas). Slide-in da
 * esquerda. Fecha por click fora, ESC ou no botão X.
 * Controle de visibilidade é externo — componente é stateless quanto a
 * isso, só recebe `open` por prop.
 */
export function WorkflowSidebar({ open, onClose }: WorkflowSidebarProps) {
  const [tab, setTab] = useState<TabKey>('characters')
  const [characters, setCharacters] = useState<CharacterEntry[]>([])
  const [scenarios, setScenarios] = useState<ScenarioEntry[]>([])
  const [search, setSearch] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  // Fetch lazy — só quando drawer abre pela primeira vez
  const fetched = useRef(false)
  useEffect(() => {
    if (!open || fetched.current) return
    fetched.current = true
    fetch('/api/library')
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, CharacterEntry>) => {
        const list = Object.entries(data).map(([charId, entry]) => ({ ...entry, charId }))
        setCharacters(list)
      })
      .catch(() => {})
    fetch('/api/scenarios')
      .then(r => r.ok ? r.json() : [])
      .then((data: ScenarioEntry[]) => setScenarios(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [open])

  // Click outside + ESC
  useEffect(() => {
    if (!open) return
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onClose() }
    const onDown = (ev: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(ev.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open, onClose])

  const startDrag = (ev: React.DragEvent<HTMLDivElement>, item: DraggableItem) => {
    ev.dataTransfer.setData('application/workflow-item', JSON.stringify(item))
    ev.dataTransfer.effectAllowed = 'copy'
  }

  const filteredChars = characters.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()),
  )
  const filteredScen = scenarios.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <>
      {/* Backdrop sutil — clica pra fechar, não bloqueia view do canvas */}
      {open && (
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0, zIndex: 19,
            background: 'rgba(10, 8, 20, 0.35)',
            backdropFilter: 'blur(2px)',
            transition: 'opacity 160ms ease',
          }}
        />
      )}

      {/* Panel slide-in */}
      <div
        ref={panelRef}
        style={{
          position: 'absolute',
          top: 10, bottom: 10, left: 10,
          width: 270,
          zIndex: 20,
          background: wfColors.surface,
          border: `1px solid ${wfColors.border}`,
          borderRadius: wfRadius.card,
          boxShadow: wfShadow.menu,
          display: 'flex', flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(calc(-100% - 20px))',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform 180ms ease, opacity 180ms ease',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${wfColors.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: wfColors.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Biblioteca
          </span>
          <button
            onClick={onClose}
            title="Fechar (Esc)"
            style={{
              background: 'transparent', border: 'none', color: wfColors.textDim,
              cursor: 'pointer', padding: 2,
              display: 'inline-flex', alignItems: 'center',
            }}
          >
            <UIIcons.close size={14} {...DEFAULT_ICON_PROPS} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${wfColors.border}` }}>
          {([
            { key: 'characters' as const, label: 'Personagens', count: characters.length },
            { key: 'scenarios' as const, label: 'Cenários', count: scenarios.length },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '8px 4px',
                background: tab === t.key ? wfColors.surfaceDeep : 'transparent',
                border: 'none', borderBottom: tab === t.key ? `2px solid ${wfColors.edgeDefault}` : '2px solid transparent',
                color: tab === t.key ? wfColors.text : wfColors.textDim,
                fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ padding: '8px 10px' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..."
            style={{
              width: '100%', padding: '6px 8px', borderRadius: wfRadius.control,
              background: wfColors.surfaceDeep, border: `1px solid ${wfColors.border}`,
              color: wfColors.text, fontSize: 11, fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 10px' }}>
          {tab === 'characters' && (
            filteredChars.length === 0 ? (
              <div style={{ fontSize: 11, color: wfColors.textFaint, padding: 12, textAlign: 'center' }}>
                Nenhum personagem.
              </div>
            ) : (
              filteredChars.map(c => (
                <div
                  key={c.charId}
                  draggable
                  onDragStart={ev => startDrag(ev, {
                    kind: 'character',
                    label: c.name,
                    content: {
                      charId: c.charId,
                      name: c.name,
                      emoji: c.emoji,
                      sheetUrl: c.sheetUrl,
                    },
                  })}
                  title={`Arrastar ${c.name} pro canvas`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: 6, marginBottom: 4, borderRadius: wfRadius.control,
                    background: wfColors.surfaceDeep, border: `1px solid ${wfColors.border}`,
                    cursor: 'grab',
                  }}
                >
                  {c.sheetUrl ? (
                    <img src={c.sheetUrl} alt={c.name} style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: 4, background: wfColors.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', color: wfColors.textFaint, flexShrink: 0 }}>
                      {(() => {
                        const Icon = NODE_TYPE_ICONS.character
                        return <Icon size={18} {...DEFAULT_ICON_PROPS} />
                      })()}
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: wfColors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: 9, color: wfColors.textDim }}>
                      {c.photos || 0} foto{(c.photos || 0) === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
              ))
            )
          )}

          {tab === 'scenarios' && (
            filteredScen.length === 0 ? (
              <div style={{ fontSize: 11, color: wfColors.textFaint, padding: 12, textAlign: 'center' }}>
                Nenhum cenário.
              </div>
            ) : (
              filteredScen.map(s => (
                <div
                  key={s.id}
                  draggable
                  onDragStart={ev => startDrag(ev, {
                    kind: 'scenario',
                    label: s.name,
                    content: { scenarioId: s.id, name: s.name, imageUrl: s.imageUrl },
                  })}
                  title={`Arrastar ${s.name} pro canvas`}
                  style={{
                    marginBottom: 6, borderRadius: wfRadius.control, overflow: 'hidden',
                    background: wfColors.surfaceDeep, border: `1px solid ${wfColors.border}`,
                    cursor: 'grab',
                  }}
                >
                  <div style={{ aspectRatio: '16/9', background: wfColors.surface }}>
                    {s.imageUrl && (
                      <img src={s.imageUrl} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <div style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, color: wfColors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.name}
                  </div>
                </div>
              ))
            )
          )}
        </div>

        <div style={{
          padding: '6px 10px', borderTop: `1px solid ${wfColors.border}`,
          fontSize: 9, color: wfColors.textFaint, textAlign: 'center',
        }}>
          Arraste pro canvas
        </div>
      </div>
    </>
  )
}
