'use client'

/**
 * ReferenceAssetPicker — modal standalone para escolher uma ReferenceAsset
 * já registrada pelo usuário (imagens, vídeos, áudios).
 *
 * Uso típico:
 *   const [open, setOpen] = useState(false)
 *   <ReferenceAssetPicker
 *     open={open}
 *     mediaType="image"
 *     onClose={() => setOpen(false)}
 *     onPick={(ref) => { setRefUrl(ref.url); setOpen(false) }}
 *   />
 *
 * Carrega via `/api/references?mediaType=...&scope=me`. Polling não é
 * necessário — o usuário clica "Atualizar" se quiser refresh.
 *
 * Intencionalmente isolado do AAZStudio.tsx para que M2-PR7 (decomposição)
 * consiga extrair pedaço por pedaço sem esbarrar neste componente.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listReferences,
  deleteReference,
  type ReferenceAssetView,
  type ReferenceMediaType,
} from '@/lib/referencesClient'

const STYLES = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(8, 8, 12, 0.78)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  },
  panel: {
    width: 'min(960px, 96vw)',
    maxHeight: '88vh',
    background: '#1a1a24',
    border: '1px solid #2e2e3e',
    borderRadius: 12,
    boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid #2e2e3e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    color: '#E8E8F0',
    letterSpacing: 0.2,
  },
  closeBtn: {
    background: 'transparent',
    border: '1px solid #2e2e3e',
    color: '#9898B0',
    borderRadius: 8,
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: 13,
  },
  toolbar: {
    padding: '10px 20px',
    borderBottom: '1px solid #2e2e3e',
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  chip: (active: boolean) => ({
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    background: active ? '#C9A84C' : 'transparent',
    color: active ? '#13131a' : '#E8E8F0',
    border: `1px solid ${active ? '#C9A84C' : '#2e2e3e'}`,
    cursor: 'pointer',
  }),
  search: {
    marginLeft: 'auto',
    background: '#13131a',
    color: '#E8E8F0',
    border: '1px solid #2e2e3e',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 13,
    width: 180,
  },
  grid: {
    padding: 16,
    overflowY: 'auto' as const,
    display: 'grid',
    gap: 12,
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    alignContent: 'start',
  },
  card: {
    background: '#22222e',
    border: '1px solid #2e2e3e',
    borderRadius: 10,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
    cursor: 'pointer',
    transition: 'border-color 0.15s, transform 0.1s',
  },
  cardHover: { borderColor: '#C9A84C', transform: 'translateY(-1px)' },
  thumb: {
    width: '100%',
    aspectRatio: '1 / 1',
    objectFit: 'cover' as const,
    background: '#13131a',
    display: 'block',
  },
  thumbFallback: {
    width: '100%',
    aspectRatio: '1 / 1',
    background: '#13131a',
    color: '#9898B0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
  },
  meta: {
    padding: '8px 10px',
    fontSize: 11,
    color: '#9898B0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  sourceTag: {
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 10,
    background: '#2e2e3e',
    color: '#E8E8F0',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  empty: {
    padding: 48,
    color: '#9898B0',
    textAlign: 'center' as const,
    fontSize: 14,
  },
  error: {
    padding: 16,
    color: '#F87171',
    textAlign: 'center' as const,
    fontSize: 13,
  },
  trashBtn: {
    background: 'transparent',
    border: 'none',
    color: '#F87171',
    cursor: 'pointer',
    fontSize: 12,
    padding: 2,
  },
}

const MEDIA_EMOJI: Record<ReferenceMediaType, string> = {
  image: '🖼',
  video: '🎞',
  audio: '🎵',
}

const SOURCE_LABELS: Record<string, string> = {
  upload: 'Upload',
  generated: 'Gerado',
  asset_library: 'Biblioteca',
  external: 'Externo',
}

export interface ReferenceAssetPickerProps {
  open: boolean
  /** Filtra por tipo de mídia. Se omitido, mostra todos. */
  mediaType?: ReferenceMediaType
  /** 'me' (padrão) filtra pelo próprio user; 'workspace' vê refs do time. */
  scope?: 'me' | 'workspace'
  /** Callback ao escolher uma ref. */
  onPick: (reference: ReferenceAssetView) => void
  /** Callback ao fechar sem escolher. */
  onClose: () => void
  /** Título customizado. */
  title?: string
}

export function ReferenceAssetPicker({
  open,
  mediaType,
  scope = 'me',
  onPick,
  onClose,
  title,
}: ReferenceAssetPickerProps) {
  const [items, setItems] = useState<ReferenceAssetView[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [mediaFilter, setMediaFilter] = useState<ReferenceMediaType | undefined>(
    mediaType,
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listReferences({
        mediaType: mediaFilter,
        scope,
        limit: 100,
      })
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao listar')
    } finally {
      setLoading(false)
    }
  }, [mediaFilter, scope])

  useEffect(() => {
    if (open) {
      setMediaFilter(mediaType)
    }
  }, [open, mediaType])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((r) => {
      const name =
        typeof r.metadata?.originalName === 'string'
          ? (r.metadata.originalName as string).toLowerCase()
          : ''
      return (
        r.url.toLowerCase().includes(q) ||
        name.includes(q) ||
        r.source.toLowerCase().includes(q)
      )
    })
  }, [items, query])

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      if (!confirm('Remover esta referência do histórico?')) return
      try {
        await deleteReference(id, { deleteBlob: true })
        setItems((prev) => prev.filter((r) => r.id !== id))
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Falha ao remover')
      }
    },
    [],
  )

  if (!open) return null

  return (
    <div style={STYLES.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div style={STYLES.panel} onClick={(e) => e.stopPropagation()}>
        <div style={STYLES.header}>
          <div style={STYLES.title}>
            {title ?? 'Escolher referência do histórico'}
          </div>
          <button style={STYLES.closeBtn} onClick={onClose}>
            Fechar
          </button>
        </div>

        <div style={STYLES.toolbar}>
          <span
            style={STYLES.chip(mediaFilter === undefined)}
            onClick={() => setMediaFilter(undefined)}
          >
            Todos
          </span>
          <span
            style={STYLES.chip(mediaFilter === 'image')}
            onClick={() => setMediaFilter('image')}
          >
            🖼 Imagens
          </span>
          <span
            style={STYLES.chip(mediaFilter === 'video')}
            onClick={() => setMediaFilter('video')}
          >
            🎞 Vídeos
          </span>
          <span
            style={STYLES.chip(mediaFilter === 'audio')}
            onClick={() => setMediaFilter('audio')}
          >
            🎵 Áudios
          </span>
          <input
            style={STYLES.search}
            placeholder="Buscar..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {error && <div style={STYLES.error}>{error}</div>}
        {!error && loading && items.length === 0 && (
          <div style={STYLES.empty}>Carregando...</div>
        )}
        {!error && !loading && filtered.length === 0 && (
          <div style={STYLES.empty}>
            Nenhuma referência encontrada. Faça um upload para começar.
          </div>
        )}

        {filtered.length > 0 && (
          <div style={STYLES.grid}>
            {filtered.map((ref) => (
              <div
                key={ref.id}
                style={{
                  ...STYLES.card,
                  ...(hoveredId === ref.id ? STYLES.cardHover : {}),
                }}
                onMouseEnter={() => setHoveredId(ref.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onPick(ref)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onPick(ref)
                }}
              >
                {ref.mediaType === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ref.url}
                    alt={
                      typeof ref.metadata?.originalName === 'string'
                        ? (ref.metadata.originalName as string)
                        : 'reference'
                    }
                    style={STYLES.thumb}
                  />
                ) : (
                  <div style={STYLES.thumbFallback}>
                    {MEDIA_EMOJI[ref.mediaType]}
                  </div>
                )}
                <div style={STYLES.meta}>
                  <span style={STYLES.sourceTag}>
                    {SOURCE_LABELS[ref.source] ?? ref.source}
                  </span>
                  <button
                    style={STYLES.trashBtn}
                    onClick={(e) => handleDelete(e, ref.id)}
                    title="Remover"
                    aria-label="Remover"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
