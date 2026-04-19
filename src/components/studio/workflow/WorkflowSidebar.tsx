'use client'

import React, { useEffect, useState } from 'react'
import { wfColors } from './theme/workflowTheme'
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

export function WorkflowSidebar() {
  const [tab, setTab] = useState<TabKey>('characters')
  const [characters, setCharacters] = useState<CharacterEntry[]>([])
  const [scenarios, setScenarios] = useState<ScenarioEntry[]>([])
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
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
  }, [])

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

  if (collapsed) {
    return (
      <div style={{
        width: 32, flexShrink: 0,
        background: wfColors.surfaceDeep, borderRight: `1px solid ${wfColors.border}`,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 12,
      }}>
        <button
          onClick={() => setCollapsed(false)}
          title="Mostrar biblioteca"
          style={{
            background: 'transparent', border: 'none', color: wfColors.textDim,
            cursor: 'pointer', padding: 4, display: 'inline-flex', alignItems: 'center',
          }}
        >
          <UIIcons.chevronRight size={16} {...DEFAULT_ICON_PROPS} />
        </button>
      </div>
    )
  }

  return (
    <div style={{
      width: 240, flexShrink: 0,
      background: wfColors.surfaceDeep, borderRight: `1px solid ${wfColors.border}`,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px', borderBottom: `1px solid ${wfColors.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: wfColors.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Biblioteca
        </span>
        <button
          onClick={() => setCollapsed(true)}
          title="Esconder"
          style={{ background: 'transparent', border: 'none', color: wfColors.textDim, cursor: 'pointer', padding: 2, display: 'inline-flex', alignItems: 'center' }}
        >
          <UIIcons.chevronLeft size={14} {...DEFAULT_ICON_PROPS} />
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
              background: tab === t.key ? wfColors.surface : 'transparent',
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
            width: '100%', padding: '6px 8px', borderRadius: 6,
            background: wfColors.surface, border: `1px solid ${wfColors.border}`,
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
                  padding: 6, marginBottom: 4, borderRadius: 6,
                  background: wfColors.surface, border: `1px solid ${wfColors.border}`,
                  cursor: 'grab',
                }}
              >
                {c.sheetUrl ? (
                  <img src={c.sheetUrl} alt={c.name} style={{ width: 36, height: 36, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: 4, background: wfColors.surfaceDeep, display: 'flex', alignItems: 'center', justifyContent: 'center', color: wfColors.textFaint, flexShrink: 0 }}>
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
                  marginBottom: 6, borderRadius: 6, overflow: 'hidden',
                  background: wfColors.surface, border: `1px solid ${wfColors.border}`,
                  cursor: 'grab',
                }}
              >
                <div style={{ aspectRatio: '16/9', background: wfColors.surfaceDeep }}>
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
  )
}
