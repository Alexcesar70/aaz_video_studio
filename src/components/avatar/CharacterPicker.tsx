'use client'

/**
 * CharacterPicker — seletor de Character a partir da biblioteca.
 *
 * Busca /api/assets?type=character, que retorna LEAD_CHARACTERS +
 * custom assets do workspace. Esses são os mesmos personagens que
 * o AAZStudio usa com sucesso pra gerar avatares fiéis.
 *
 * Stateless quanto ao valor — controle via props (value, onChange).
 * Funciona tanto standalone (Creators) quanto dentro de nó (Workflow).
 */

import React, { useEffect, useMemo, useState } from 'react'
import type { Asset } from '@/lib/assets'
import { CharacterCreateModal } from './CharacterCreateModal'

export interface CharacterPickerProps {
  /** slug do character atualmente selecionado, ou null */
  value: string | null
  onChange: (character: Asset | null) => void
  /** cor de destaque (ring quando selecionado) */
  accent?: string
  /** layout reduzido (pra usar dentro de nó do Workflow) */
  compact?: boolean
}

const C = {
  bg: '#0F0D1A',
  surface: '#1A1628',
  border: '#3A3555',
  text: '#E8E5F0',
  textDim: '#9F9AB8',
  textFaint: '#6B6688',
}

export function CharacterPicker({ value, onChange, accent = '#8B5CF6', compact = false }: CharacterPickerProps) {
  const [characters, setCharacters] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const loadCharacters = () => {
    setLoading(true)
    return fetch('/api/assets?type=character')
      .then(r => r.json())
      .then((data: { assets?: Asset[] }) => {
        setCharacters(data.assets ?? [])
        setLoading(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Falha ao carregar.')
        setLoading(false)
      })
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/assets?type=character')
      .then(r => r.json())
      .then((data: { assets?: Asset[] }) => {
        if (cancelled) return
        setCharacters(data.assets ?? [])
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Falha ao carregar.')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const handleCreated = (asset: Asset) => {
    setModalOpen(false)
    // Adiciona o novo ao topo da lista localmente e seleciona
    setCharacters(prev => [asset, ...prev.filter(c => c.id !== asset.id)])
    onChange(asset)
    // Re-fetch em background pra sincronizar com o servidor
    void loadCharacters()
  }

  const selected = useMemo(
    () => characters.find(c => c.id === value) ?? null,
    [characters, value],
  )

  const cellSize = compact ? 56 : 72
  const createBtn = (
    <button
      key="__create__"
      onClick={() => setModalOpen(true)}
      title="Criar novo personagem"
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 3, padding: 4,
        background: 'transparent',
        border: `1px dashed ${accent}`,
        borderRadius: 8,
        color: accent, cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 10,
        minHeight: cellSize,
        transition: 'all 120ms ease',
      }}
    >
      <div style={{ fontSize: compact ? 16 : 20, lineHeight: 1 }}>＋</div>
      <span style={{ fontSize: compact ? 9 : 10 }}>Novo</span>
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {selected && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px',
          background: `${accent}15`,
          border: `1px solid ${accent}55`,
          borderRadius: 8,
          fontSize: 11, color: C.text,
        }}>
          {selected.emoji && <span style={{ fontSize: 16 }}>{selected.emoji}</span>}
          <span style={{ fontWeight: 600, flex: 1 }}>{selected.name}</span>
          <button
            onClick={() => onChange(null)}
            title="Remover seleção"
            style={{
              background: 'transparent', border: 'none', color: C.textDim,
              cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 2,
            }}
          >×</button>
        </div>
      )}

      {loading && (
        <div style={{ color: C.textFaint, fontSize: 11, padding: 4 }}>
          Carregando personagens…
        </div>
      )}
      {error && (
        <div style={{ color: '#ff5d7a', fontSize: 11, padding: 4 }}>{error}</div>
      )}
      {!loading && !error && characters.length === 0 && (
        <div style={{ color: C.textFaint, fontSize: 11, padding: 4 }}>
          Nenhum personagem na biblioteca — clique em ＋ Novo pra criar.
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${cellSize}px, 1fr))`,
        gap: 6,
        maxHeight: compact ? 140 : 260,
        overflowY: 'auto',
        padding: 4,
      }}>
        {createBtn}
        {characters.map(c => {
          const isSelected = c.id === value
          const firstImg = c.imageUrls?.[0]
          return (
            <button
              key={c.id}
              onClick={() => onChange(c)}
              title={`${c.name}${c.description ? ` — ${c.description}` : ''}`}
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 3, padding: 4,
                background: isSelected ? `${accent}25` : C.surface,
                border: `1px solid ${isSelected ? accent : C.border}`,
                borderRadius: 8,
                color: C.text, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 10,
                boxShadow: isSelected ? `0 0 0 2px ${accent}35` : 'none',
                transition: 'all 120ms ease',
              }}
            >
              <div style={{
                width: '100%', aspectRatio: '1',
                background: C.bg, borderRadius: 4,
                overflow: 'hidden', position: 'relative',
              }}>
                {firstImg ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={firstImg} alt={c.name} style={{
                    width: '100%', height: '100%', objectFit: 'cover',
                  }} />
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: compact ? 20 : 26,
                  }}>
                    {c.emoji || '👤'}
                  </div>
                )}
                {c.imageUrls && c.imageUrls.length > 1 && (
                  <div style={{
                    position: 'absolute', bottom: 2, right: 2,
                    padding: '1px 4px', borderRadius: 3,
                    background: 'rgba(0,0,0,0.6)', color: '#fff',
                    fontSize: 8, fontWeight: 700,
                  }}>
                    {c.imageUrls.length}
                  </div>
                )}
              </div>
              <span style={{
                fontSize: compact ? 9 : 10, textAlign: 'center',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                width: '100%',
              }}>
                {c.name}
              </span>
            </button>
          )
        })}
      </div>

      <CharacterCreateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
        accent={accent}
      />
    </div>
  )
}
