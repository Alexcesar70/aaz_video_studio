'use client'

import React, { useState, useEffect } from 'react'
import { C } from '@/components/studio/theme'
import { useWorkspace } from '@/lib/workspaceContext'
import type { Asset } from '@/lib/assets'
import { defaultEmoji } from '@/lib/assets'

type AssetFilter = 'character' | 'scenario' | 'item' | 'all'

export default function AssetsPage() {
  const { user } = useWorkspace()
  const [assets, setAssets] = useState<Asset[]>([])
  const [filter, setFilter] = useState<AssetFilter>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/assets')
      .then(r => r.ok ? r.json() : { assets: [] })
      .then(data => setAssets(data.assets ?? []))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? assets : assets.filter(a => a.type === filter)

  const counts = {
    all: assets.length,
    character: assets.filter(a => a.type === 'character').length,
    scenario: assets.filter(a => a.type === 'scenario').length,
    item: assets.filter(a => a.type === 'item').length,
  }

  const filters: { id: AssetFilter; label: string }[] = [
    { id: 'all', label: `Todos (${counts.all})` },
    { id: 'character', label: `Personagens (${counts.character})` },
    { id: 'scenario', label: `Cenários (${counts.scenario})` },
    { id: 'item', label: `Props (${counts.item})` },
  ]

  return (
    <div style={{ padding: '32px', color: C.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Assets</h1>
        <button
          style={{ background: C.purple, border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
        >
          + Novo Asset
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: C.card, padding: 4, borderRadius: 10, border: `1px solid ${C.border}` }}>
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              flex: 1, padding: '10px', borderRadius: 8,
              background: filter === f.id ? C.surface : 'transparent',
              border: filter === f.id ? `1px solid ${C.border}` : '1px solid transparent',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              color: filter === f.id ? C.text : C.textDim, fontFamily: 'inherit',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: C.textDim }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎨</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Nenhum asset encontrado</div>
          <div style={{ fontSize: 13, color: C.textDim }}>Crie personagens, cenários e props no Atelier.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {filtered.map(a => (
            <div key={a.id} style={{
              background: C.card, border: `1px solid ${a.isOfficial ? `${C.gold}60` : C.border}`,
              borderRadius: 12, overflow: 'hidden',
            }}>
              <div style={{ aspectRatio: '1/1', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {a.imageUrls?.length > 0
                  ? <img src={a.imageUrls[0]} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 48 }}>{a.emoji || defaultEmoji(a.type)}</span>
                }
              </div>
              <div style={{ padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>{a.emoji || defaultEmoji(a.type)}</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{a.name}</span>
                  {a.isOfficial && <span style={{ fontSize: 9, color: C.gold, background: `${C.gold}20`, padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>LEAD</span>}
                </div>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>
                  {a.imageUrls?.length ?? 0} refs · {a.type}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
