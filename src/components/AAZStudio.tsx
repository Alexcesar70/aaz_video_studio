'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { VIDEO_ENGINES, DEFAULT_ENGINE_ID, getEngine } from '@/lib/videoEngines'
import { IMAGE_ENGINES, DEFAULT_IMAGE_ENGINE_ID, getImageEngine } from '@/lib/imageEngines'
import type { Asset, AssetType } from '@/lib/assets'
import { LEAD_CHARACTERS, slugify, isLeadId, defaultEmoji } from '@/lib/assets'
import { MOODS, DEFAULT_MOOD_ID, getMood, type MoodId } from '@/lib/moods'
import { PERMISSIONS, PERMISSION_LABELS, PRODUCTS, PRODUCT_LABELS, hasPermission, type Permission, type Product } from '@/lib/permissions'
import { pollJobUntilDone, type JobPollingView } from '@/lib/jobPolling'
import { C } from './studio/theme'
import { Pill, Label, Divider, Input } from './studio/atoms'
import type {
  CurrentUser,
  Character,
  RefItem,
  LibraryEntry,
  ScenarioEntry,
  Project,
  Episode,
  SceneStatus,
  SceneAsset,
  HistoryItem,
} from './studio/types'
import { MoveSceneModal } from './studio/modals/MoveSceneModal'
import { MoveEpisodeModal } from './studio/modals/MoveEpisodeModal'
import { NewUserCredsModal } from './studio/modals/NewUserCredsModal'
import { KpiCard } from './studio/widgets/KpiCard'
import { HistoryTab } from './studio/tabs/HistoryTab'
import { InviteUserModal } from './studio/modals/InviteUserModal'

/* ═══════════════════════════════════════════════════════════════
   AAZ COM JESUS · PRODUCTION STUDIO v2 — Next.js Edition
   Chamadas Segmind agora via /api/generate e /api/generate-sheet
   API keys nunca expostas no browser
═══════════════════════════════════════════════════════════════ */

/* Palette, types and atoms extraídos para src/components/studio/* (M2-PR7). */

const CHARACTERS = [
  { id: 'abraao', name: 'Abraão', emoji: '👴', color: '#C9A84C', desc: '8 year old boy, messy orange-red hair, fair skin with freckles, hazel-green eyes, slightly protruding ears, pink vest over teal t-shirt, gray cargo shorts, green-mint canvas sneakers' },
  { id: 'abigail', name: 'Abigail', emoji: '👧', color: '#D4A0C8', desc: '7 year old girl, dark curly hair in two side puffs, warm brown skin, big brown eyes with defined lashes, rosy cheeks, multi-layered dress with colorful geometric print, colorful neck scarf, beaded bracelets, burgundy-pink flats' },
  { id: 'zaqueu', name: 'Zaqueu', emoji: '🧔', color: '#7AB8D4', desc: '9 year old boy, mini-dreads with clay texture, deep dark skin, expressive brown eyes, wide smile, open olive-green jacket with gold buttons over orange t-shirt, geometric colorful shorts, colorful canvas sneakers with orange laces' },
  { id: 'tuba', name: 'Tuba', emoji: '🐕', color: '#C8A07A', desc: 'a cartoon dog, medium sized dog character, four legs, amber-orange fur, cream chest and belly, rounded black nose, expressive dark-brown eyes, floppy ears, curled tail, NOT a human' },
  { id: 'theos', name: 'Theos', emoji: '✨', color: '#A8D4FF', desc: 'a luminous winged boy figure, glowing warm light, soft feathered wings, gentle ethereal presence, youthful face, kind eyes, flowing robes in white and gold' },
  { id: 'miriam', name: 'Miriã', emoji: '👩', color: '#D4C0A0', desc: 'adult woman, mother, curly hair, wears apron, welcoming warm eyes, kind expression' },
  { id: 'elias', name: 'Elias', emoji: '🧙', color: '#A0D4B0', desc: 'adult man, father, short beard, large hands, calm presence, gentle expression' },
]

const MODES = [
  { id: 'text_to_video', label: 'Texto → Vídeo', icon: '✍', desc: 'Geração por prompt puro' },
  { id: 'first_last_frames', label: 'First/Last Frame', icon: '⇄', desc: 'Controle de início e fim' },
  { id: 'omni_reference', label: 'Omni Reference', icon: '⊞', desc: '9 imgs + 3 vids + 3 áudios' },
]

const RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9']
const DURATIONS = [4, 5, 8, 10, 12, 15]

/* ── Storage — biblioteca de sheets compartilhada via Vercel KV ── */

/* Types, atoms, e palette: ver imports acima em studio/* (M2-PR7). */

/* HistoryTab + SceneCard + EpisodeHeader + EpisodeDeliveryCard
   extraídos para studio/tabs/HistoryTab.tsx + studio/widgets/* (M5-PR6).
   HistoryTabProps agora é exportado de studio/tabs/HistoryTab.tsx. */

/* ═══════════════════════════════════════════════════════════════
   AtelierLibraryView — grid de assets (leads + criados)
   Declarado fora do AAZStudio pra não ser recriado a cada render.
═══════════════════════════════════════════════════════════════ */

function AtelierAssetCard({ asset, onDelete }: { asset: Asset; onDelete: (a: Asset) => void }) {
  const accent = asset.isOfficial ? C.gold : C.purple
  const emoji = asset.emoji || defaultEmoji(asset.type)
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${asset.isOfficial ? `${C.gold}60` : C.border}`,
      borderRadius: 12,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>
      {/* Badge lead */}
      {asset.isOfficial && (
        <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, background: 'rgba(0,0,0,0.75)', color: C.gold, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', border: `1px solid ${C.gold}60` }}>
          ⭐ LEAD
        </div>
      )}
      {/* Imagem */}
      <div style={{ aspectRatio: '1/1', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60 }}>
        {asset.imageUrls.length > 0 ? (
          <img src={asset.imageUrls[0]} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span>{emoji}</span>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{emoji}</span>
          <span>{asset.name}</span>
        </div>
        <div style={{ fontSize: 11, fontFamily: 'monospace', color: accent }}>@{asset.id}</div>
        {asset.description && (
          <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{asset.description}</div>
        )}
        {asset.tags && asset.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {asset.tags.slice(0, 3).map(t => (
              <span key={t} style={{ fontSize: 9, background: C.border, color: C.textDim, padding: '2px 7px', borderRadius: 10 }}>{t}</span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          <button
            onClick={() => onDelete(asset)}
            disabled={asset.isOfficial}
            title={asset.isOfficial ? 'Personagem oficial — não pode ser removido' : 'Deletar'}
            style={{
              flex: 1,
              background: asset.isOfficial ? 'transparent' : `${C.red}15`,
              border: `1px solid ${asset.isOfficial ? C.border : `${C.red}40`}`,
              borderRadius: 8,
              padding: '6px',
              cursor: asset.isOfficial ? 'not-allowed' : 'pointer',
              color: asset.isOfficial ? C.textDim : C.red,
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'inherit',
              opacity: asset.isOfficial ? 0.4 : 1,
            }}
          >
            {asset.isOfficial ? '🔒 Oficial' : '× Deletar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   SceneAssetsStrip — faixa visual sempre presente no Estúdio
   mostrando os assets que estão linkados à cena em edição.

   Fontes:
     1) refImgs — agrupados por charId (ou label quando sem charId)
     2) @mentions no texto do prompt atual (detectadas por regex)

   Mostra chips clicáveis. Click = remover o asset da cena.
═══════════════════════════════════════════════════════════════ */

function SceneAssetsStrip({
  refImgs,
  promptText,
  atAssets,
  mood,
  onMoodChange,
  onRemove,
  onOpenAtelier,
}: {
  refImgs: RefItem[]
  promptText: string
  atAssets: Asset[]
  mood: MoodId
  onMoodChange: (m: MoodId) => void
  onRemove: (charId: string) => void
  onOpenAtelier: () => void
}) {
  const currentMood = getMood(mood)
  // Agrupa refImgs por charId (asset único) — conta quantas imagens cada um tem
  const grouped = new Map<string, { name: string; count: number; emoji: string; color: string; type: AssetType; fromLib: boolean }>()
  for (const r of refImgs) {
    const key = r.charId ?? `anon_${r.label}`
    const existing = grouped.get(key)
    if (existing) {
      existing.count += 1
    } else {
      // Resolve emoji/color a partir dos leads, assets custom ou padrão
      const leadChar = CHARACTERS.find(c => c.id === r.charId)
      const customAsset = atAssets.find(a => a.id === r.charId && !a.isOfficial)
      grouped.set(key, {
        name: r.name || r.charId || r.label,
        count: 1,
        emoji: leadChar?.emoji ?? customAsset?.emoji ?? '📎',
        color: leadChar?.color ?? (customAsset?.type === 'scenario' ? C.blue : customAsset?.type === 'item' ? C.gold : C.purple),
        type: (customAsset?.type ?? 'character') as AssetType,
        fromLib: !!r.fromLib,
      })
    }
  }

  // Extrai @mentions do prompt
  const mentionedIds = new Set<string>()
  const mentionRegex = /@(\w+)/g
  let m: RegExpExecArray | null
  while ((m = mentionRegex.exec(promptText)) !== null) {
    const id = m[1].toLowerCase()
    // Ignora @imageN / @videoN / @audioN (são tags técnicas já resolvidas)
    if (/^(image|video|audio)\d+$/.test(id)) continue
    mentionedIds.add(id)
  }

  // Mentions não resolvidas (aparecem no prompt mas não há ref)
  const pendingMentions: string[] = []
  for (const id of Array.from(mentionedIds)) {
    if (!grouped.has(id)) pendingMentions.push(id)
  }

  const hasAnyAsset = grouped.size > 0 || pendingMentions.length > 0

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 14px',
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      marginBottom: 12,
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
        {hasAnyAsset ? 'CENA' : 'MOOD DA CENA'}
      </span>

      {/* Mood chip — select visível estilizado como pílula.
          Abrir o native dropdown, trocar, dispara onMoodChange.
          Seta SVG à direita via background-image. */}
      <select
        value={mood}
        onChange={e => onMoodChange(e.target.value as MoodId)}
        title={`Mood atual: ${currentMood.shortLabel} — ${currentMood.narrative}. Clique pra trocar.`}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          background: `${C.purple}18`,
          border: `1px solid ${C.purple}60`,
          borderRadius: 20,
          padding: '5px 28px 5px 12px',
          fontSize: 12,
          fontWeight: 700,
          color: C.purple,
          cursor: 'pointer',
          fontFamily: 'inherit',
          outline: 'none',
          backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23a78bfa' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 9px center',
          lineHeight: 1.5,
        }}
      >
        {MOODS.map(m => (
          <option key={m.id} value={m.id}>
            {m.icon} {m.shortLabel} — {m.narrative}
          </option>
        ))}
      </select>

      {Array.from(grouped.entries()).map(([key, g]) => (
        <div
          key={key}
          title={`${g.name} · ${g.count} ${g.count === 1 ? 'imagem' : 'imagens'}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: `${g.color}18`,
            border: `1px solid ${g.color}50`,
            borderRadius: 20,
            padding: '4px 10px 4px 8px',
            fontSize: 12,
          }}
        >
          <span style={{ fontSize: 16 }}>{g.emoji}</span>
          <span style={{ fontWeight: 600, color: g.color }}>{g.name}</span>
          <span style={{ fontSize: 10, color: g.color, opacity: 0.7 }}>×{g.count}</span>
          {key && !key.startsWith('anon_') && (
            <button
              onClick={() => onRemove(key)}
              title="Remover desta cena"
              style={{ background: 'transparent', border: 'none', color: g.color, cursor: 'pointer', fontSize: 14, padding: 0, marginLeft: 2, lineHeight: 1 }}
            >
              ×
            </button>
          )}
        </div>
      ))}

      {pendingMentions.map(id => (
        <div
          key={`pending-${id}`}
          title={`@${id} foi mencionado no prompt mas não tem imagem de referência`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: `${C.gold}12`,
            border: `1px dashed ${C.gold}60`,
            borderRadius: 20,
            padding: '4px 10px',
            fontSize: 12,
            color: C.gold,
          }}
        >
          <span style={{ fontSize: 12 }}>⚠</span>
          <span style={{ fontFamily: 'monospace' }}>@{id}</span>
          <span style={{ fontSize: 10, opacity: 0.7 }}>sem ref</span>
        </div>
      ))}

      <button
        onClick={onOpenAtelier}
        title="Abrir o Atelier de imagens"
        style={{ marginLeft: 'auto', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 16, padding: '4px 12px', cursor: 'pointer', color: C.textDim, fontSize: 11, fontFamily: 'inherit' }}
      >
        🎨 Atelier
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   QuickCreateAssetModal — cria um asset sem sair do Estúdio.
   Reusa /api/image-director + /api/generate-image, mas é auto-contido:
   tem seu próprio form state, gera, mostra resultados, e quando o
   usuário escolhe uma variação chama onDone(asset) — que injeta no
   refImgs da cena atual e fecha o modal.
═══════════════════════════════════════════════════════════════ */

function QuickCreateAssetModal({
  type,
  initialName,
  onClose,
  onDone,
  uploadBlob,
}: {
  type: AssetType
  initialName: string
  onClose: () => void
  onDone: (asset: Asset) => void
  uploadBlob: (file: File) => Promise<string>
}) {
  const [name, setName] = useState(initialName)
  const [id, setId] = useState(slugify(initialName))
  const [idEdited, setIdEdited] = useState(false)
  const [desc, setDesc] = useState('')
  const [engineId, setEngineId] = useState(DEFAULT_IMAGE_ENGINE_ID)
  const [mood, setMood] = useState<MoodId>(DEFAULT_MOOD_ID)
  const [variations, setVariations] = useState(4)
  const [refUrl, setRefUrl] = useState('')
  const [refining, setRefining] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState<string[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [status, setStatus] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const engine = getImageEngine(engineId)
  const totalCost = (engine.pricePerImage * variations).toFixed(2)

  useEffect(() => {
    if (!idEdited) setId(slugify(name))
  }, [name, idEdited])

  const typeLabel = type === 'character' ? 'Personagem' : type === 'scenario' ? 'Cenário' : 'Item'
  const typeEmoji = defaultEmoji(type)

  const refine = async () => {
    if (!desc.trim()) { setStatus('Escreva a descrição antes.'); return }
    setRefining(true); setStatus('Refinando...')
    try {
      const res = await fetch('/api/image-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, description: desc, has_reference: !!refUrl, mood }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || `Erro ${res.status}`) }
      const data = await res.json() as { prompt: string; name_suggestion: string }
      setDesc(data.prompt)
      if (!name.trim() && data.name_suggestion) setName(data.name_suggestion)
      setStatus('Prompt refinado ✓')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Erro ao refinar.')
    } finally {
      setRefining(false)
    }
  }

  const generate = async () => {
    if (!desc.trim() || !name.trim()) { setStatus('Preencha nome e descrição.'); return }
    setGenerating(true); setStatus('Gerando variações...'); setResults([]); setSelected(null)
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineId,
          prompt: desc,
          num_outputs: variations,
          reference_image_url: refUrl || undefined,
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || `Erro ${res.status}`) }
      const data = await res.json() as { imageUrls: string[] }
      setResults(data.imageUrls ?? [])
      setStatus(`${data.imageUrls?.length ?? 0} variações prontas. Clique numa pra usar.`)

      // Salva todas como drafts (30 dias)
      for (const url of data.imageUrls ?? []) {
        fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type, name, description: desc,
            imageUrls: [url], prompt: desc, engineId,
            sourceRefUrl: refUrl || undefined,
            isDraft: true,
          }),
        }).catch(() => {})
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Erro ao gerar.')
    } finally {
      setGenerating(false)
    }
  }

  const useSelected = async () => {
    if (selected === null) return
    const chosenUrl = results[selected]
    if (!chosenUrl) return
    const finalId = (id || slugify(name)).toLowerCase()
    setStatus('Salvando...')
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: finalId, type, name, description: desc,
          imageUrls: [chosenUrl],
          prompt: desc, engineId,
          sourceRefUrl: refUrl || undefined,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        // Se já existe um asset com esse id, o parent ainda pode injetar a imagem na cena
        console.warn('[QuickCreate] POST falhou:', e?.error)
      }
      const now = new Date().toISOString()
      onDone({
        id: finalId, type, name, description: desc,
        imageUrls: [chosenUrl], prompt: desc, engineId,
        sourceRefUrl: refUrl || undefined,
        isOfficial: false, createdAt: now, updatedAt: now,
      })
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Erro ao salvar.')
    }
  }

  const handleUpload = async (file: File) => {
    try {
      const url = await uploadBlob(file)
      setRefUrl(url)
    } catch {
      setStatus('Upload falhou.')
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, width: '100%', maxWidth: 820, maxHeight: '92vh', overflow: 'auto', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 26 }}>{typeEmoji}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Criar {typeLabel}</div>
              <div style={{ fontSize: 11, color: C.textDim }}>Gera e adiciona direto na cena atual</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textDim, fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: results.length > 0 ? '1fr 1fr' : '1fr', gap: 18 }}>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 4 }}>NOME</div>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder={type === 'character' ? 'Faraó' : type === 'scenario' ? 'Nilo' : 'Cajado'} />
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 4 }}>@ID (auto)</div>
              <Input value={id} onChange={e => { setId(slugify(e.target.value)); setIdEdited(true) }} style={{ fontFamily: 'monospace' }} />
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 4 }}>DESCRIÇÃO</div>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder={type === 'character' ? 'Faraó do Egito, adulto, coroa dupla...' : type === 'scenario' ? 'Interior do palácio ao entardecer...' : 'Cajado de madeira...'}
                style={{ width: '100%', minHeight: 100, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
              />
              <button onClick={refine} disabled={refining || !desc.trim()} style={{ marginTop: 6, background: C.purpleGlow, border: `1px solid ${C.purple}50`, borderRadius: 8, padding: '6px 12px', cursor: refining ? 'wait' : 'pointer', color: C.purple, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', opacity: (refining || !desc.trim()) ? 0.5 : 1 }}>
                {refining ? '⟳' : '✨'} Refinar com IA
              </button>
            </div>

            {refUrl ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src={refUrl} alt="ref" style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.border}` }} />
                <button onClick={() => setRefUrl('')} style={{ position: 'absolute', top: -5, right: -5, background: C.red, color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: 11 }}>×</button>
              </div>
            ) : (
              <>
                <button onClick={() => fileInput.current?.click()} style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: C.textDim, fontSize: 12, fontFamily: 'inherit' }}>
                  📎 Anexar referência opcional
                </button>
                <input ref={fileInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
              </>
            )}

            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px', marginBottom: 4 }}>MOOD / TOM VISUAL</div>
              <select value={mood} onChange={e => setMood(e.target.value as MoodId)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%' }}>
                {MOODS.map(m => <option key={m.id} value={m.id}>{m.label} — {m.narrative}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
              <select value={engineId} onChange={e => setEngineId(e.target.value)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
                {IMAGE_ENGINES.map(eng => (
                  <option key={eng.id} value={eng.id}>{eng.name} · ~${eng.pricePerImage}</option>
                ))}
              </select>
              <select value={variations} onChange={e => setVariations(parseInt(e.target.value, 10))} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, fontFamily: 'monospace', outline: 'none' }}>
                {[1, 2, 4, 6, 8].map(n => <option key={n} value={n}>{n} var</option>)}
              </select>
            </div>

            <div style={{ fontSize: 11, color: C.textDim, textAlign: 'right', fontStyle: 'italic' }}>
              Custo: ${totalCost}
            </div>

            <button
              onClick={generate}
              disabled={generating || !name.trim() || !desc.trim()}
              style={{ background: generating ? C.card : C.purple, border: `1px solid ${generating ? C.border : C.purple}`, borderRadius: 10, padding: '12px', cursor: (generating || !name.trim() || !desc.trim()) ? 'not-allowed' : 'pointer', color: generating ? C.textDim : '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}
            >
              {generating ? '⟳ Gerando...' : `⚡ Gerar ${variations} ${variations === 1 ? 'variação' : 'variações'}`}
            </button>

            {status && <div style={{ fontSize: 11, color: C.textDim, textAlign: 'center' }}>{status}</div>}
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim }}>ESCOLHA UMA VARIAÇÃO</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {results.map((url, i) => {
                  const isSel = selected === i
                  return (
                    <div
                      key={i}
                      onClick={() => setSelected(i)}
                      style={{ position: 'relative', cursor: 'pointer', borderRadius: 8, overflow: 'hidden', border: `3px solid ${isSel ? C.green : 'transparent'}`, aspectRatio: '1/1', background: '#000' }}
                    >
                      <img src={url} alt={`var ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: 12, padding: '2px 8px', fontSize: 10 }}>#{i + 1}</div>
                      {isSel && <div style={{ position: 'absolute', top: 4, right: 4, background: C.green, color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✓</div>}
                    </div>
                  )
                })}
              </div>
              <button
                onClick={useSelected}
                disabled={selected === null}
                style={{ background: selected === null ? C.card : C.green, border: `1px solid ${selected === null ? C.border : C.green}`, borderRadius: 10, padding: '12px', cursor: selected === null ? 'not-allowed' : 'pointer', color: selected === null ? C.textDim : '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}
              >
                Usar esta na cena
              </button>
              <div style={{ fontSize: 10, color: C.textDim, textAlign: 'center', fontStyle: 'italic' }}>
                As outras variações ficam em Rascunhos do Atelier por 30 dias.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AtelierDraftsView({ type, drafts, onPromote, onDelete }: {
  type: AssetType
  drafts: Asset[]
  onPromote: (d: Asset) => void
  onDelete: (d: Asset) => void
}) {
  if (drafts.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: C.textDim, fontSize: 13, border: `1px dashed ${C.border}`, borderRadius: 10 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🗂</div>
        <div>Nenhum rascunho de {type === 'character' ? 'personagem' : type === 'scenario' ? 'cenário' : 'item'}.</div>
        <div style={{ fontSize: 11, marginTop: 6 }}>Variações geradas mas não promovidas pra Biblioteca ficam aqui por 30 dias.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
      {drafts.map(d => {
        const created = new Date(d.createdAt)
        const daysLeft = Math.max(0, Math.ceil((created.getTime() + 30 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000)))
        return (
          <div key={d.id} style={{ background: C.card, border: `1px solid ${C.gold}40`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ aspectRatio: '1/1', background: '#000' }}>
              {d.imageUrls[0] && <img src={d.imageUrls[0]} alt={d.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{d.name}</div>
              <div style={{ fontSize: 10, color: C.gold }}>Expira em {daysLeft}d</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => onPromote(d)}
                  style={{ flex: 1, background: `${C.green}20`, border: `1px solid ${C.green}60`, borderRadius: 6, padding: '5px', cursor: 'pointer', color: C.green, fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}
                >
                  ↑ Promover
                </button>
                <button
                  onClick={() => onDelete(d)}
                  style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: C.red, fontSize: 11, fontFamily: 'inherit' }}
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* Budget pill — mostra % usado do cap mensal do creator no header */
function BudgetPill({ usedUsd, capUsd, percentageUsed }: { usedUsd: number; capUsd: number; percentageUsed: number }) {
  const pct = Math.min(percentageUsed, 100)
  const exceeded = percentageUsed >= 100
  const warning = percentageUsed >= 80
  const color = exceeded ? C.red : warning ? C.gold : C.green
  const label = exceeded ? 'BUDGET EXCEDIDO' : warning ? 'BUDGET' : 'BUDGET'
  return (
    <div
      title={`Você usou ~$${usedUsd.toFixed(2)} de $${capUsd.toFixed(2)} este mês (${percentageUsed.toFixed(0)}%)`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: `${color}15`,
        border: `1px solid ${color}50`,
        borderRadius: 20,
        padding: '4px 12px',
        fontSize: 11,
        fontFamily: 'inherit',
      }}
    >
      <span style={{ color, fontWeight: 700, letterSpacing: '0.3px', fontSize: 9 }}>{label}</span>
      <div style={{ width: 50, height: 5, background: C.card, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.3s' }} />
      </div>
      <span style={{ color, fontFamily: 'monospace', fontWeight: 700 }}>
        ${usedUsd.toFixed(0)}/${capUsd}
      </span>
    </div>
  )
}

/* Wallet pill — mostra saldo da wallet da org no header */
type WalletAlertLevel = 'ok' | 'warning' | 'critical' | 'danger' | 'empty'
interface WalletInfo { balance: number; totalTopUps: number; totalSpent: number; alertLevel: WalletAlertLevel; walletId: string }
function WalletPill({ wallet, showBrl, brlRate, onClick }: { wallet: WalletInfo; showBrl?: boolean; brlRate?: number | null; onClick?: () => void }) {
  const { balance, totalTopUps, alertLevel } = wallet
  const color =
    alertLevel === 'empty' ? C.red
    : alertLevel === 'danger' ? C.red
    : alertLevel === 'critical' ? '#F59E0B'
    : alertLevel === 'warning' ? C.gold
    : C.green
  const label =
    alertLevel === 'empty' ? 'SEM SALDO'
    : alertLevel === 'danger' ? 'SALDO CRITICO'
    : alertLevel === 'critical' ? 'SALDO CRITICO'
    : alertLevel === 'warning' ? 'SALDO BAIXO'
    : 'SALDO'
  const pct = totalTopUps > 0 ? Math.min((balance / totalTopUps) * 100, 100) : 100
  const isFlashing = alertLevel === 'empty'
  const brlText = showBrl && brlRate ? ` (~R$${(balance * brlRate).toFixed(2)})` : ''
  return (
    <div
      onClick={onClick}
      title={`Saldo: $${balance.toFixed(2)}${brlText} | Total investido: $${totalTopUps.toFixed(2)} | Gasto total: $${wallet.totalSpent.toFixed(2)} | Clique para ver extrato`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: `${color}15`,
        border: `1px solid ${color}50`,
        borderRadius: 20,
        padding: '4px 12px',
        fontSize: 11,
        fontFamily: 'inherit',
        cursor: onClick ? 'pointer' : undefined,
        animation: isFlashing ? 'walletFlash 1s ease-in-out infinite' : undefined,
      }}
    >
      <span style={{ color, fontWeight: 700, letterSpacing: '0.3px', fontSize: 9 }}>{label}</span>
      <div style={{ width: 50, height: 5, background: C.card, borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.3s' }} />
      </div>
      <span style={{ color, fontFamily: 'monospace', fontWeight: 700 }}>
        ${balance.toFixed(2)}{showBrl && brlRate ? <span style={{ color: C.textDim, fontWeight: 500, fontSize: 10 }}> (~R${(balance * brlRate).toFixed(2)})</span> : null}
      </span>
      {isFlashing && <style>{`@keyframes walletFlash { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   AdminPanel — aba 👑 Admin visível só pra role=admin.
   4 sub-abas: Dashboard, Usuários, Revisão, Gastos.
   Declarado fora do AAZStudio pra não re-criar a cada render.
═══════════════════════════════════════════════════════════════ */

interface AdminUser {
  id: string
  email: string
  name: string
  role: 'super_admin' | 'admin' | 'creator'
  status: 'active' | 'revoked'
  monthlyBudgetUsd?: number
  assignedProjectIds?: string[]
  permissions?: string[]
  products?: string[]
  createdAt: string
  lastActiveAt?: string
  createdBy: string
}

interface ActivityEventView {
  id: string
  userId: string
  userName?: string
  userEmail?: string
  userRole?: string
  timestamp: string
  type: string
  meta: {
    cost?: number
    engineId?: string
    duration?: number
    variations?: number
    label?: string
    assetType?: string
    newStatus?: string
    oldStatus?: string
    projectId?: string
    episodeId?: string
    sceneId?: string
    assetId?: string
    targetUserId?: string
    extra?: {
      costSource?: 'real' | 'estimated'
      estimatedCostUsd?: number
      realCostUsd?: number | null
    }
  }
}

interface MonthlyTotals {
  totalCost: number
  eventCounts: Record<string, number>
  byUser: Record<string, { cost: number; counts: Record<string, number> }>
}

function AdminPanel({
  currentUser,
  onOpenDelivery,
  showBrl,
  brlRate,
}: {
  currentUser: CurrentUser | null
  onOpenDelivery: (ep: Episode) => void
  showBrl?: boolean
  brlRate?: number | null
}) {
  const [subTab, setSubTab] = useState<'dashboard' | 'users' | 'review' | 'spend'>('dashboard')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [events, setEvents] = useState<ActivityEventView[]>([])
  const [monthly, setMonthly] = useState<MonthlyTotals | null>(null)
  const [deliveryEpisodes, setDeliveryEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [newUserCreds, setNewUserCreds] = useState<{ email: string; name: string; password: string } | null>(null)
  const [segmindBalance, setSegmindBalance] = useState<number | null>(null)
  const [allScenes, setAllScenes] = useState<{ id: string; episodeId: string | null; cost: string; duration: number; createdBy?: string; createdAt: string }[]>([])
  const [allEpisodes, setAllEpisodes] = useState<Episode[]>([])
  const [orgWallet, setOrgWallet] = useState<{ balance: number; totalTopUps: number; totalSpent: number } | null>(null)

  // Month/year selectors + user detail modal
  const now = new Date()
  const currentMonthStr = now.toISOString().slice(0, 7) // "2026-04"
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr)
  const [detailUserId, setDetailUserId] = useState<string | null>(null)

  // Available years (from 2025 to current+1) and months
  const currentYear = now.getFullYear()
  const yearOptions = useMemo(() => {
    const years: number[] = []
    for (let y = 2026; y <= 2036; y++) years.push(y)
    return years
  }, [])
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

  const selectedYear = parseInt(selectedMonth.slice(0, 4))
  const selectedMonthNum = parseInt(selectedMonth.slice(5, 7)) // 1-12

  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  const handleMonthYearChange = (month: number, year: number) => {
    const ym = `${year}-${String(month).padStart(2, '0')}`
    setSelectedMonth(ym)
    loadAll(ym)
  }

  const loadAll = useCallback(async (month?: string) => {
    const m = month ?? selectedMonth
    setLoading(true)
    try {
      const from = `${m}-01`
      const toDate = new Date(parseInt(m.slice(0, 4)), parseInt(m.slice(5, 7)), 0) // last day of month
      const to = toDate.toISOString().slice(0, 10)
      const [usersRes, eventsRes, monthlyRes, epsRes, scenesRes, balanceRes] = await Promise.all([
        fetch('/api/users'),
        fetch(`/api/activity?mode=events&limit=2000&from=${from}&to=${to}`),
        fetch('/api/activity?mode=monthly'),
        fetch('/api/episodes'),
        fetch('/api/scenes'),
        fetch('/api/segmind-balance').catch(() => null),
      ])
      if (usersRes.ok) {
        const data = await usersRes.json()
        setUsers(data.users ?? [])
      }
      if (eventsRes.ok) {
        const data = await eventsRes.json()
        setEvents(data.events ?? [])
      }
      if (monthlyRes.ok) {
        const data = await monthlyRes.json()
        setMonthly(data)
      }
      if (epsRes.ok) {
        const eps = await epsRes.json() as Episode[]
        setAllEpisodes(eps)
        setDeliveryEpisodes(eps.filter(e => e.finalVideoUrl))
      }
      if (scenesRes && scenesRes.ok) {
        const scenes = await scenesRes.json()
        setAllScenes(Array.isArray(scenes) ? scenes : [])
      }
      if (balanceRes && balanceRes.ok) {
        const bd = await balanceRes.json()
        setSegmindBalance(bd.balance ?? null)
      }
      // Wallet da org (para Team Leader)
      try {
        const walletRes = await fetch('/api/me/wallet')
        if (walletRes.ok) {
          const wd = await walletRes.json()
          if (wd.balance != null) setOrgWallet({ balance: wd.balance, totalTopUps: wd.totalTopUps ?? 0, totalSpent: wd.totalSpent ?? 0 })
        }
      } catch {}
    } catch (err) {
      console.error('[admin] load failed', err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth])

  useEffect(() => { loadAll() }, [loadAll])

  // Derive month label from selectedMonth
  const monthLabel = (() => {
    const [y, m] = selectedMonth.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  })()

  // Eventos do mês selecionado (filtro por timestamp)
  const monthlyEvents = events.filter(e => e.timestamp.slice(0, 7) === selectedMonth)

  // Gasto total do mês — soma direta dos custos dos eventos
  const computedMonthlyCost = monthlyEvents
    .filter(e => e.meta.cost != null && e.meta.cost > 0)
    .reduce((sum, e) => sum + (e.meta.cost ?? 0), 0)

  // Atividade últimos 7 dias = usuários com lastActiveAt recente
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const activeUsers7d = users.filter(u => u.lastActiveAt && u.lastActiveAt >= sevenDaysAgo)

  // Cenas dessa semana (eventos scene_generated últimos 7 dias)
  const scenesThisWeek = events.filter(e => e.type === 'scene_generated' && e.timestamp >= sevenDaysAgo).length
  const assetsThisWeek = events.filter(e => e.type === 'asset_saved' && e.timestamp >= sevenDaysAgo).length

  // Top criadores por gasto — calculado dos eventos do mês
  const creatorMap = new Map<string, { cost: number; scenes: number; assets: number }>()
  for (const e of monthlyEvents) {
    const uid = e.userId
    if (!creatorMap.has(uid)) creatorMap.set(uid, { cost: 0, scenes: 0, assets: 0 })
    const bucket = creatorMap.get(uid)!
    if (e.meta.cost != null && e.meta.cost > 0) bucket.cost += e.meta.cost
    if (e.type === 'scene_generated') bucket.scenes++
    if (e.type === 'asset_saved') bucket.assets++
  }
  const topCreators = Array.from(creatorMap.entries())
    .map(([userId, data]) => {
      const u = users.find(us => us.id === userId)
      return {
        id: userId,
        name: u?.name ?? userId,
        email: u?.email ?? '',
        cost: data.cost,
        scenes: data.scenes,
        assets: data.assets,
      }
    })
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5)

  // Uso por engine — conta scene_generated por engineId
  const engineUsage = new Map<string, number>()
  for (const e of events) {
    if ((e.type === 'scene_generated' || e.type === 'image_generated') && e.meta.engineId) {
      engineUsage.set(e.meta.engineId, (engineUsage.get(e.meta.engineId) ?? 0) + 1)
    }
  }
  const engineUsageList = Array.from(engineUsage.entries()).sort((a, b) => b[1] - a[1])
  const totalEngineUse = engineUsageList.reduce((sum, [, n]) => sum + n, 0) || 1

  // ── Métricas avançadas ──
  const sceneEvents = monthlyEvents.filter(e => e.type === 'scene_generated')
  const avgCostPerScene = sceneEvents.length > 0
    ? sceneEvents.reduce((s, e) => s + (e.meta.cost ?? 0), 0) / sceneEvents.length : 0

  // Taxa de aproveitamento: cenas salvas em episódios vs total de gerações
  const scenesInEpisodes = allScenes.filter(s => s.episodeId != null).length
  const totalSavedScenes = allScenes.length
  const utilizationRate = totalSavedScenes > 0 ? (scenesInEpisodes / totalSavedScenes) * 100 : 0

  // Projeção mensal: gasto atual / dia do mês × dias no mês
  const dayOfMonth = new Date().getDate()
  const daysInMonth = new Date(selectedYear, selectedMonthNum, 0).getDate()
  const isCurrentMonth = selectedMonth === currentMonthStr
  const projectedCost = isCurrentMonth && dayOfMonth > 0
    ? (computedMonthlyCost / dayOfMonth) * daysInMonth : computedMonthlyCost

  // Custo por episódio (cenas agrupadas)
  const episodeCosts = new Map<string, { name: string; sceneCount: number; totalCost: number }>()
  for (const s of allScenes) {
    if (!s.episodeId) continue
    if (!episodeCosts.has(s.episodeId)) {
      const ep = allEpisodes.find(e => e.id === s.episodeId)
      episodeCosts.set(s.episodeId, { name: ep?.name ?? '(sem nome)', sceneCount: 0, totalCost: 0 })
    }
    const bucket = episodeCosts.get(s.episodeId)!
    bucket.sceneCount++
    bucket.totalCost += parseFloat(s.cost) || 0
  }
  const episodeCostList = Array.from(episodeCosts.entries()).sort((a, b) => b[1].totalCost - a[1].totalCost)

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>👑</span>
            <span>Admin Panel</span>
          </div>
          <div style={{ fontSize: 13, color: C.textDim, marginTop: 4 }}>
            Mission control da produção · v4.0
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={selectedMonthNum}
            onChange={e => handleMonthYearChange(parseInt(e.target.value), selectedYear)}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
          >
            {monthNames.map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={e => handleMonthYearChange(selectedMonthNum, parseInt(e.target.value))}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() => loadAll()}
            disabled={loading}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 16px', cursor: 'pointer', color: C.textDim, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}
          >
            {loading ? '⟳ Carregando...' : '↻ Atualizar'}
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, background: C.card, padding: 4, borderRadius: 10, border: `1px solid ${C.border}` }}>
        {([
          ['dashboard', '📊 Dashboard'],
          ['users', `👥 Usuários (${users.length})`],
          ['review', `🎬 Revisão${deliveryEpisodes.filter(e => e.finalStatus === 'pending_review').length > 0 ? ` (${deliveryEpisodes.filter(e => e.finalStatus === 'pending_review').length})` : ''}`],
          ['spend', '💰 Gastos'],
        ] as [typeof subTab, string][]).map(([id, lbl]) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 8,
              background: subTab === id ? C.surface : 'transparent',
              border: subTab === id ? `1px solid ${C.border}` : '1px solid transparent',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: subTab === id ? C.text : C.textDim,
              fontFamily: 'inherit',
            }}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* ═══ DASHBOARD ═══ */}
      {subTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* KPIs — linha 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <KpiCard label="Saldo disponível" value={orgWallet ? `$${orgWallet.balance.toFixed(2)}` : '—'} sub={orgWallet ? `recebido: $${orgWallet.totalTopUps.toFixed(2)}` : 'sem wallet'} color={orgWallet && orgWallet.balance < 5 ? C.red : C.green} />
            <KpiCard label="Gasto este mês" value={`$${computedMonthlyCost.toFixed(2)}${showBrl && brlRate ? ` (~R$${(computedMonthlyCost * brlRate).toFixed(2)})` : ''}`} sub={isCurrentMonth ? `projeção: ~$${projectedCost.toFixed(2)}` : monthLabel} color={C.green} />
            <KpiCard label="Custo médio/cena" value={`$${avgCostPerScene.toFixed(2)}`} sub={`${sceneEvents.length} cenas no mês`} color={C.blue} />
            <KpiCard label="Criadores ativos" value={`${activeUsers7d.length}/${users.length}`} sub="últimos 7 dias" color={C.purple} />
          </div>
          {/* KPIs — linha 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <KpiCard label="Cenas (semana)" value={`${scenesThisWeek}`} sub="vídeos gerados" color={C.blue} />
            <KpiCard label="Assets (semana)" value={`${assetsThisWeek}`} sub="novos na biblioteca" color={C.gold} />
            <KpiCard label="Episódios" value={`${episodeCostList.length}`} sub={`custo total: $${episodeCostList.reduce((s, [, d]) => s + d.totalCost, 0).toFixed(2)}`} color={C.green} />
            <KpiCard label="Aproveitamento" value={`${utilizationRate.toFixed(0)}%`} sub={`${scenesInEpisodes}/${totalSavedScenes} em episódios`} color={utilizationRate >= 60 ? C.green : utilizationRate >= 30 ? C.gold : C.red} />
          </div>

          {/* BRL disclaimer */}
          {showBrl && brlRate && (
            <div style={{ fontSize: 10, color: C.textDim, fontStyle: 'italic', textAlign: 'right' }}>
              Cotacao aproximada: 1 USD = R${brlRate.toFixed(2)}
            </div>
          )}

          {/* Top criadores + Engines */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            {/* Top criadores */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>
                Top criadores · {monthLabel}
              </div>
              {topCreators.length === 0 ? (
                <div style={{ color: C.textDim, fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                  Sem gastos registrados ainda este mês.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topCreators.map((c, i) => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: i === 0 ? C.gold : C.border, color: i === 0 ? '#000' : C.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div onClick={() => setDetailUserId(c.id)} style={{ fontSize: 13, fontWeight: 600, color: C.blue, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', textDecoration: 'underline', textDecorationColor: `${C.blue}40`, textUnderlineOffset: 2 }}>{c.name}</div>
                        <div style={{ fontSize: 10, color: C.textDim }}>{c.scenes} cenas · {c.assets} assets</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.green, fontFamily: 'monospace', textAlign: 'right' }}>
                        ~${c.cost.toFixed(2)}{showBrl && brlRate ? <div style={{ fontSize: 9, color: C.textDim, fontWeight: 500 }}>~R${(c.cost * brlRate).toFixed(2)}</div> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Motores mais usados */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>
                Motores mais usados
              </div>
              {engineUsageList.length === 0 ? (
                <div style={{ color: C.textDim, fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                  Nenhuma geração ainda.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {engineUsageList.slice(0, 6).map(([id, count]) => {
                    const pct = (count / totalEngineUse) * 100
                    return (
                      <div key={id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                          <span style={{ color: C.text, fontWeight: 600 }}>{id}</span>
                          <span style={{ color: C.textDim }}>{count} · {pct.toFixed(0)}%</span>
                        </div>
                        <div style={{ height: 6, background: C.card, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: C.purple, borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Feed de atividade */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>
              Atividade recente · últimos {events.length} eventos
            </div>
            {events.length === 0 ? (
              <div style={{ color: C.textDim, fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                Nenhuma atividade registrada ainda.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
                {events.slice(0, 50).map(e => (
                  <ActivityRow key={e.id} event={e} onClickUser={() => setDetailUserId(e.userId)} showBrl={showBrl} brlRate={brlRate} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ USUÁRIOS ═══ */}
      {subTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
              Usuários ({users.length})
            </div>
            <button
              onClick={() => setInviteOpen(true)}
              style={{ background: C.gold, border: `1px solid ${C.gold}`, borderRadius: 10, padding: '10px 20px', cursor: 'pointer', color: '#000', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}
            >
              ＋ Convidar criador
            </button>
          </div>

          {users.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.textDim, fontSize: 13, border: `1px dashed ${C.border}`, borderRadius: 10 }}>
              Nenhum usuário ainda.
            </div>
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 0.5fr', gap: 12, padding: '10px 16px', background: C.card, fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px' }}>
                <div>NOME</div>
                <div>EMAIL</div>
                <div>ROLE</div>
                <div>GASTO MÊS</div>
                <div>ÚLTIMA ATIVIDADE</div>
                <div></div>
              </div>
              {users.map(u => {
                const userCost = monthlyEvents.filter(e => e.userId === u.id && e.meta.cost != null && e.meta.cost > 0).reduce((s, e) => s + (e.meta.cost ?? 0), 0)
                const budgetPct = u.monthlyBudgetUsd ? (userCost / u.monthlyBudgetUsd) * 100 : null
                const lastActive = u.lastActiveAt ? new Date(u.lastActiveAt) : null
                const lastActiveStr = lastActive ? relativeTime(lastActive) : 'nunca'
                return (
                  <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 0.5fr', gap: 12, padding: '12px 16px', borderTop: `1px solid ${C.border}`, fontSize: 13, alignItems: 'center', opacity: u.status === 'revoked' ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: u.role === 'admin' ? C.gold : C.purple, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span onClick={() => setDetailUserId(u.id)} style={{ color: C.blue, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: `${C.blue}40`, textUnderlineOffset: 2 }}>{u.name}</span>
                    </div>
                    <div style={{ color: C.textDim, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: u.role === 'admin' ? C.gold : C.purple, background: u.role === 'admin' ? `${C.gold}20` : `${C.purple}20`, padding: '3px 8px', borderRadius: 6, border: `1px solid ${u.role === 'admin' ? C.gold : C.purple}50`, letterSpacing: '0.3px' }}>
                        {u.role === 'admin' ? '👑 ADMIN' : '🎨 CREATOR'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: C.text, fontFamily: 'monospace' }}>
                      ${userCost.toFixed(2)}
                      {budgetPct !== null && (
                        <div style={{ fontSize: 9, color: budgetPct > 80 ? C.red : C.textDim }}>
                          {budgetPct.toFixed(0)}% de ${u.monthlyBudgetUsd}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: C.textDim }}>{lastActiveStr}</div>
                    <div style={{ fontSize: 10, color: C.textDim, textAlign: 'right' }}>
                      {u.status === 'revoked' && <span style={{ color: C.red }}>revogado</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ GASTOS ═══ */}
      {/* ═══ REVISÃO DE ENTREGAS ═══ */}
      {subTab === 'review' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
            Revisão de entregas finais
          </div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: -6 }}>
            Episódios montados pelos criadores no CapCut/Premiere e enviados pra revisão. Clique num card pra abrir, assistir e aprovar/pedir ajustes.
          </div>
          {deliveryEpisodes.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.textDim, fontSize: 13, border: `1px dashed ${C.border}`, borderRadius: 10 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
              Nenhuma entrega registrada ainda.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Ordena: pending_review primeiro, depois needs_changes, depois approved */}
              {[...deliveryEpisodes]
                .sort((a, b) => {
                  const order = { pending_review: 0, needs_changes: 1, approved: 2, none: 3 } as const
                  const sa = order[a.finalStatus ?? 'none']
                  const sb = order[b.finalStatus ?? 'none']
                  if (sa !== sb) return sa - sb
                  return (b.finalVideoUploadedAt ?? '').localeCompare(a.finalVideoUploadedAt ?? '')
                })
                .map(ep => {
                  const status = ep.finalStatus ?? 'none'
                  const statusColor = status === 'approved' ? C.green : status === 'needs_changes' ? C.gold : C.purple
                  const statusLabel = status === 'approved' ? '✓ Aprovado' : status === 'needs_changes' ? '🟠 Precisa ajustes' : '🟡 Aguardando revisão'
                  const uploader = users.find(u => u.id === ep.finalVideoUploadedBy)
                  return (
                    <div
                      key={ep.id}
                      onClick={() => onOpenDelivery(ep)}
                      style={{
                        background: C.surface,
                        border: `1px solid ${statusColor}50`,
                        borderRadius: 12,
                        padding: 14,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        transition: 'all 0.15s',
                      }}
                    >
                      {ep.finalVideoUrl && (
                        <video src={ep.finalVideoUrl} muted playsInline preload="metadata" style={{ width: 120, height: 68, borderRadius: 8, objectFit: 'cover', background: '#000', border: `1px solid ${statusColor}40`, flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                          {ep.name || '(sem nome)'}
                        </div>
                        <div style={{ fontSize: 11, color: C.textDim, marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {uploader && <span>por {uploader.name}</span>}
                          {ep.finalVideoSizeMB && <span>· {ep.finalVideoSizeMB} MB</span>}
                          {ep.finalVideoUploadedAt && <span>· enviado {relativeTime(new Date(ep.finalVideoUploadedAt))}</span>}
                        </div>
                        {ep.creatorNote && (
                          <div style={{ fontSize: 11, color: C.text, marginTop: 6, fontStyle: 'italic', maxWidth: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            &ldquo;{ep.creatorNote}&rdquo;
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, background: `${statusColor}20`, border: `1px solid ${statusColor}50`, padding: '4px 10px', borderRadius: 12, whiteSpace: 'nowrap' }}>
                          {statusLabel}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); onOpenDelivery(ep) }} style={{ background: statusColor, border: `1px solid ${statusColor}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: status === 'approved' ? '#fff' : '#000', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>
                          Revisar →
                        </button>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {subTab === 'spend' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
            Gastos detalhados
          </div>

          {/* Monthly history cards — últimos 6 meses (mais antigo à esquerda) */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {(() => {
              // Gera meses terminando no mês selecionado, ordem cronológica (antigo→recente)
              // Não mostra antes de Janeiro 2026
              const cards: { value: string; label: string }[] = []
              for (let i = 5; i >= 0; i--) {
                const d = new Date(selectedYear, selectedMonthNum - 1 - i, 1)
                if (d.getFullYear() < 2026) continue
                cards.push({
                  value: d.toISOString().slice(0, 7),
                  label: d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
                })
              }
              return cards.map(o => {
                const isSelected = o.value === selectedMonth
                return (
                  <div
                    key={o.value}
                    onClick={() => { setSelectedMonth(o.value); loadAll(o.value) }}
                    style={{
                      minWidth: 110, padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                      background: isSelected ? C.surface : C.card,
                      border: `1px solid ${isSelected ? C.gold : C.border}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: isSelected ? C.gold : C.textDim, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{o.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: isSelected ? C.green : C.textDim, fontFamily: 'monospace', marginTop: 4 }}>
                      {isSelected ? `$${computedMonthlyCost.toFixed(2)}` : '—'}
                    </div>
                  </div>
                )
              })
            })()}
          </div>

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
            {orgWallet && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                <KpiCard label="Saldo atual" value={`$${orgWallet.balance.toFixed(2)}`} color={orgWallet.balance < 5 ? C.red : C.green} />
                <KpiCard label="Total recebido" value={`$${orgWallet.totalTopUps.toFixed(2)}`} color={C.blue} />
                <KpiCard label="Total gasto" value={`$${orgWallet.totalSpent.toFixed(2)}`} color={C.purple} />
              </div>
            )}
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>
              Detalhamento por usuário · {monthLabel}
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12, fontStyle: 'italic' }}>
              Valores descontados automaticamente do saldo da organização a cada geração.
            </div>
            {(() => {
              const spendByUser = new Map<string, { cost: number; counts: Record<string, number> }>()
              for (const e of monthlyEvents) {
                if (!spendByUser.has(e.userId)) spendByUser.set(e.userId, { cost: 0, counts: {} })
                const b = spendByUser.get(e.userId)!
                if (e.meta.cost != null && e.meta.cost > 0) b.cost += e.meta.cost
                b.counts[e.type] = (b.counts[e.type] ?? 0) + 1
              }
              const spendEntries = Array.from(spendByUser.entries()).sort((a, b) => b[1].cost - a[1].cost)
              return spendEntries.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 10, padding: '8px 0', fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px', borderBottom: `1px solid ${C.border}` }}>
                  <div>USUÁRIO</div>
                  <div>CENAS</div>
                  <div>IMAGENS</div>
                  <div>SCENE DIR</div>
                  <div>IMG DIR</div>
                  <div style={{ textAlign: 'right' }}>TOTAL</div>
                </div>
                {spendEntries.map(([userId, data]) => {
                  const u = users.find(us => us.id === userId)
                  return (
                    <div key={userId} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 10, padding: '8px 0', fontSize: 12, borderBottom: `1px solid ${C.border}80` }}>
                      <div onClick={() => setDetailUserId(userId)} style={{ color: C.blue, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: `${C.blue}40`, textUnderlineOffset: 2 }}>{u?.name ?? userId}</div>
                      <div style={{ color: C.textDim, fontFamily: 'monospace' }}>{data.counts.scene_generated ?? 0}</div>
                      <div style={{ color: C.textDim, fontFamily: 'monospace' }}>{data.counts.image_generated ?? 0}</div>
                      <div style={{ color: C.textDim, fontFamily: 'monospace' }}>{data.counts.scene_director_called ?? 0}</div>
                      <div style={{ color: C.textDim, fontFamily: 'monospace' }}>{data.counts.image_director_called ?? 0}</div>
                      <div style={{ color: C.green, fontWeight: 700, fontFamily: 'monospace', textAlign: 'right' }}>${data.cost.toFixed(2)}</div>
                    </div>
                  )
                })}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', gap: 10, padding: '12px 0 0', fontSize: 13, fontWeight: 700, borderTop: `2px solid ${C.border}`, marginTop: 6 }}>
                  <div style={{ color: C.text }}>TOTAL</div>
                  <div></div><div></div><div></div><div></div>
                  <div style={{ color: C.green, fontFamily: 'monospace', textAlign: 'right' }}>${computedMonthlyCost.toFixed(2)}</div>
                </div>
              </div>
            ) : (
              <div style={{ color: C.textDim, fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                Sem gastos registrados ainda este mês.
              </div>
            )
            })()}
          </div>

          {/* Custo por Episódio */}
          {episodeCostList.length > 0 && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                Custo por episódio
              </div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 10, fontStyle: 'italic' }}>
                Apenas cenas de vídeo salvas na biblioteca. O total do mês acima inclui também imagens, Scene Director e Image Director.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, padding: '6px 0', fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px', borderBottom: `1px solid ${C.border}` }}>
                  <div>EPISÓDIO</div>
                  <div>CENAS</div>
                  <div style={{ textAlign: 'right' }}>CUSTO</div>
                </div>
                {episodeCostList.map(([epId, data]) => (
                  <div key={epId} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, padding: '8px 0', fontSize: 12, borderBottom: `1px solid ${C.border}80` }}>
                    <div style={{ color: C.text, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.name}</div>
                    <div style={{ color: C.textDim, fontFamily: 'monospace' }}>{data.sceneCount}</div>
                    <div style={{ color: C.green, fontWeight: 700, fontFamily: 'monospace', textAlign: 'right' }}>${data.totalCost.toFixed(2)}</div>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, padding: '10px 0 0', fontSize: 13, fontWeight: 700, borderTop: `2px solid ${C.border}`, marginTop: 4 }}>
                  <div style={{ color: C.text }}>TOTAL</div>
                  <div style={{ color: C.textDim, fontFamily: 'monospace' }}>{episodeCostList.reduce((s, [, d]) => s + d.sceneCount, 0)}</div>
                  <div style={{ color: C.green, fontFamily: 'monospace', textAlign: 'right' }}>${episodeCostList.reduce((s, [, d]) => s + d.totalCost, 0).toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Convidar criador */}
      {inviteOpen && (
        <InviteUserModal
          onClose={() => setInviteOpen(false)}
          onCreated={(creds) => {
            setNewUserCreds(creds)
            setInviteOpen(false)
            loadAll()
          }}
        />
      )}

      {/* Modal: Credenciais recém-criadas (display-once) */}
      {newUserCreds && (
        <NewUserCredsModal
          creds={newUserCreds}
          onClose={() => setNewUserCreds(null)}
        />
      )}

      {/* Modal: Detalhe do usuário */}
      {detailUserId && (
        <UserDetailModal
          userId={detailUserId}
          users={users}
          events={monthlyEvents}
          monthLabel={monthLabel}
          showBrl={showBrl}
          brlRate={brlRate}
          onClose={() => setDetailUserId(null)}
        />
      )}
    </div>
  )
}

/* Modal: Detalhe do usuário — extrato completo do mês */
function UserDetailModal({ userId, users, events, monthLabel, showBrl, brlRate, onClose }: {
  userId: string
  users: AdminUser[]
  events: ActivityEventView[]
  monthLabel: string
  showBrl?: boolean
  brlRate?: number | null
  onClose: () => void
}) {
  const brl = (usd: number) => showBrl && brlRate ? ` (≈R$${(usd * brlRate).toFixed(2)})` : ''
  const user = users.find(u => u.id === userId)
  const userEvents = events.filter(e => e.userId === userId).sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const totalCost = userEvents.filter(e => e.meta.cost != null && e.meta.cost > 0).reduce((s, e) => s + (e.meta.cost ?? 0), 0)
  const scenesCount = userEvents.filter(e => e.type === 'scene_generated').length
  const imagesCount = userEvents.filter(e => e.type === 'image_generated').length
  const directorCount = userEvents.filter(e => e.type === 'scene_director_called' || e.type === 'image_director_called').length

  // Engine breakdown
  const engineCosts = new Map<string, number>()
  for (const e of userEvents) {
    if (e.meta.engineId && e.meta.cost != null && e.meta.cost > 0) {
      engineCosts.set(e.meta.engineId, (engineCosts.get(e.meta.engineId) ?? 0) + (e.meta.cost ?? 0))
    }
  }
  const engineList = Array.from(engineCosts.entries()).sort((a, b) => b[1] - a[1])
  const maxEngineCost = engineList.length > 0 ? engineList[0][1] : 1

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, width: '100%', maxWidth: 720, maxHeight: '92vh', overflow: 'auto', padding: 26 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, letterSpacing: '0.5px' }}>EXTRATO DO USUÁRIO</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginTop: 2 }}>
              {user?.name ?? userId}
            </div>
            <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>
              {user?.email ?? ''} · <span style={{ color: user?.role === 'admin' ? C.gold : C.purple, fontWeight: 600 }}>{user?.role === 'admin' ? 'Admin' : 'Creator'}</span> · {monthLabel}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textDim, fontSize: 22, cursor: 'pointer', padding: 4 }}>x</button>
        </div>
        {showBrl && brlRate && (
          <div style={{ fontSize: 10, color: C.textDim, fontStyle: 'italic', marginBottom: 10, background: `${C.gold}10`, padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.gold}20` }}>
            Valores em R$ são aproximados · cotação: $1 = R${brlRate.toFixed(2)}
          </div>
        )}

        {/* Summary KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          {([
            ['Total gasto', `$${totalCost.toFixed(2)}${brl(totalCost)}`, C.green],
            ['Cenas', `${scenesCount}`, C.blue],
            ['Custo médio/cena', scenesCount > 0 ? `$${(totalCost / scenesCount).toFixed(2)}${brl(totalCost / scenesCount)}` : '—', C.purple],
            ['Director', `${directorCount}`, C.gold],
          ] as [string, string, string][]).map(([lbl, val, col]) => (
            <div key={lbl} style={{ background: C.surface, border: `1px solid ${col}40`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px', marginBottom: 4 }}>{lbl.toUpperCase()}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: col, fontFamily: 'monospace' }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Extrato */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Extrato</div>
          {userEvents.length === 0 ? (
            <div style={{ color: C.textDim, fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Nenhum evento neste mês.</div>
          ) : (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 28px 1fr auto', gap: 8, padding: '8px 14px', background: C.card, fontSize: 9, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px' }}>
                <div>DATA/HORA</div>
                <div></div>
                <div>DESCRIÇÃO</div>
                <div style={{ textAlign: 'right' }}>CUSTO</div>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {userEvents.map(ev => {
                  const dt = new Date(ev.timestamp)
                  const dateStr = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  const icon = activityIcon(ev.type)
                  const desc = activityDescription(ev)
                  const costSource = ev.meta.extra?.costSource
                  const hasCost = ev.meta.cost != null && ev.meta.cost > 0
                  return (
                    <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: '140px 28px 1fr auto', gap: 8, padding: '8px 14px', borderTop: `1px solid ${C.border}`, fontSize: 12, alignItems: 'center' }}>
                      <div style={{ color: C.textDim, fontSize: 11, fontFamily: 'monospace' }}>{dateStr}</div>
                      <div style={{ fontSize: 14 }}>{icon}</div>
                      <div style={{ color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{desc}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        {hasCost && (
                          <>
                            {costSource === 'real' ? (
                              <span style={{ fontSize: 8, fontWeight: 700, color: C.green, background: `${C.green}20`, border: `1px solid ${C.green}50`, borderRadius: 3, padding: '0px 4px', letterSpacing: '0.3px' }}>REAL</span>
                            ) : (
                              <span style={{ fontSize: 8, color: C.textDim, fontStyle: 'italic' }}>est.</span>
                            )}
                            <span style={{ color: C.green, fontFamily: 'monospace', fontWeight: 600, fontSize: 11 }}>${(ev.meta.cost ?? 0).toFixed(3)}{brl(ev.meta.cost ?? 0)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Total row */}
              <div style={{ display: 'grid', gridTemplateColumns: '140px 28px 1fr auto', gap: 8, padding: '12px 14px', borderTop: `2px solid ${C.border}`, background: C.card }}>
                <div></div><div></div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>TOTAL</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.green, fontFamily: 'monospace' }}>${totalCost.toFixed(2)}{brl(totalCost)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Engine breakdown */}
        {engineList.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>Custo por motor</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {engineList.map(([id, cost]) => {
                const pct = (cost / maxEngineCost) * 100
                return (
                  <div key={id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                      <span style={{ color: C.text, fontWeight: 600 }}>{id}</span>
                      <span style={{ color: C.green, fontFamily: 'monospace', fontWeight: 600 }}>${cost.toFixed(2)}{brl(cost)}</span>
                    </div>
                    <div style={{ height: 6, background: C.card, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: C.purple, borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* Wallet Extrato Modal — extrato de transações para o próprio usuário */
interface WalletTxn {
  id: string
  walletId: string
  type: string
  amountUsd: number
  balanceAfter: number
  description: string
  meta: Record<string, unknown>
  createdAt: string
}

const TXN_TYPE_LABELS: Record<string, string> = {
  top_up: 'Recarga',
  spend: 'Gasto',
  transfer_in: 'Transf. entrada',
  transfer_out: 'Transf. saída',
  refund: 'Reembolso',
  adjustment: 'Ajuste',
  monthly_credit: 'Crédito mensal',
}

function WalletExtratoModal({ showBrl, brlRate, onClose }: {
  showBrl?: boolean
  brlRate?: number | null
  onClose: () => void
}) {
  const [transactions, setTransactions] = useState<WalletTxn[]>([])
  const [loading, setLoading] = useState(false)
  const today = new Date()
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const todayStr = today.toISOString().slice(0, 10)
  const [fromDate, setFromDate] = useState(firstOfMonth)
  const [toDate, setToDate] = useState(todayStr)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      params.set('limit', '500')
      const res = await fetch(`/api/me/wallet/transactions?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setTransactions(data.transactions ?? [])
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [fromDate, toDate])

  useEffect(() => { fetchTransactions() }, [fetchTransactions])

  const handleExportCsv = () => {
    const params = new URLSearchParams()
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    params.set('format', 'csv')
    window.open(`/api/me/wallet/export?${params.toString()}`, '_blank')
  }

  const totalIn = transactions.filter(t => t.amountUsd > 0).reduce((s, t) => s + t.amountUsd, 0)
  const totalOut = transactions.filter(t => t.amountUsd < 0).reduce((s, t) => s + t.amountUsd, 0)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, width: '100%', maxWidth: 720, maxHeight: '92vh', overflow: 'auto', padding: 26 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: '0.5px' }}>EXTRATO DA WALLET</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginTop: 2 }}>Minhas transacoes</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textDim, fontSize: 22, cursor: 'pointer', padding: 4 }}>x</button>
        </div>

        {/* Date filters */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: C.textDim }}>De:</label>
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
          />
          <label style={{ fontSize: 12, color: C.textDim }}>Ate:</label>
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 10px', color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
          />
          <div style={{ flex: 1 }} />
          <button
            onClick={handleExportCsv}
            style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: C.text, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}
          >
            Baixar CSV
          </button>
        </div>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.green}40`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px', marginBottom: 4 }}>ENTRADAS</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.green, fontFamily: 'monospace' }}>+${totalIn.toFixed(2)}</div>
            {showBrl && brlRate ? <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>~R${(totalIn * brlRate).toFixed(2)}</div> : null}
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.red}40`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px', marginBottom: 4 }}>SAIDAS</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.red, fontFamily: 'monospace' }}>${totalOut.toFixed(2)}</div>
            {showBrl && brlRate ? <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>~R${(totalOut * brlRate).toFixed(2)}</div> : null}
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.blue}40`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px', marginBottom: 4 }}>TRANSACOES</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.blue, fontFamily: 'monospace' }}>{transactions.length}</div>
          </div>
        </div>

        {showBrl && brlRate && (
          <div style={{ fontSize: 10, color: C.textDim, fontStyle: 'italic', marginBottom: 10, textAlign: 'right' }}>
            Cotacao aproximada: 1 USD = R${brlRate.toFixed(2)}
          </div>
        )}

        {/* Transaction list */}
        {loading ? (
          <div style={{ color: C.textDim, fontSize: 12, textAlign: 'center', padding: '30px 0' }}>Carregando...</div>
        ) : transactions.length === 0 ? (
          <div style={{ color: C.textDim, fontSize: 12, textAlign: 'center', padding: '30px 0' }}>Nenhuma transacao no periodo.</div>
        ) : (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '110px 100px 1fr 90px 90px', gap: 8, padding: '8px 14px', background: C.card, fontSize: 9, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px' }}>
              <div>DATA</div>
              <div>TIPO</div>
              <div>DESCRICAO</div>
              <div style={{ textAlign: 'right' }}>VALOR</div>
              <div style={{ textAlign: 'right' }}>SALDO</div>
            </div>
            {/* Rows */}
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {transactions.map(txn => {
                const dt = new Date(txn.createdAt)
                const dateStr = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                const isPositive = txn.amountUsd > 0
                const typeLabel = TXN_TYPE_LABELS[txn.type] ?? txn.type
                return (
                  <div key={txn.id} style={{ display: 'grid', gridTemplateColumns: '110px 100px 1fr 90px 90px', gap: 8, padding: '8px 14px', borderTop: `1px solid ${C.border}`, fontSize: 12, alignItems: 'center' }}>
                    <div style={{ color: C.textDim, fontSize: 11, fontFamily: 'monospace' }}>{dateStr}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: isPositive ? C.green : C.red }}>
                      {typeLabel}
                    </div>
                    <div style={{ color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11 }} title={txn.description}>
                      {txn.description}
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: isPositive ? C.green : C.red, fontSize: 11 }}>
                      {isPositive ? '+' : ''}${txn.amountUsd.toFixed(4)}
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: 'monospace', color: C.textDim, fontSize: 11 }}>
                      ${txn.balanceAfter.toFixed(2)}
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Total row */}
            <div style={{ display: 'grid', gridTemplateColumns: '110px 100px 1fr 90px 90px', gap: 8, padding: '12px 14px', borderTop: `2px solid ${C.border}`, background: C.card }}>
              <div></div><div></div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>PERIODO</div>
              <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 800, color: C.red, fontFamily: 'monospace' }}>${totalOut.toFixed(2)}</div>
              <div style={{ textAlign: 'right', fontSize: 10, color: C.textDim }}>
                {transactions.length > 0 ? `$${transactions[0].balanceAfter.toFixed(2)}` : ''}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* Card KPI — usado no dashboard do admin */
/* KpiCard extraído para studio/widgets/KpiCard.tsx (M4-PR6). */

/* Linha de atividade no feed do dashboard */
function ActivityRow({ event, onClickUser, showBrl, brlRate }: { event: ActivityEventView; onClickUser?: () => void; showBrl?: boolean; brlRate?: number | null }) {
  const icon = activityIcon(event.type)
  const desc = activityDescription(event)
  const when = relativeTime(new Date(event.timestamp))
  const costVal = event.meta.cost ?? 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: C.card, fontSize: 12 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span onClick={onClickUser} style={{ fontWeight: 600, ...(onClickUser ? { color: C.blue, cursor: 'pointer', textDecoration: 'underline', textDecorationColor: `${C.blue}40`, textUnderlineOffset: 2 } : {}) }}>{event.userName ?? event.userId}</span>
          <span style={{ color: C.textDim }}> · {desc}</span>
        </div>
      </div>
      {event.meta.cost !== undefined && costVal > 0 && (
        <span style={{ fontSize: 10, color: C.green, fontFamily: 'monospace' }}>
          {showBrl && brlRate ? `R$${(costVal * brlRate).toFixed(2)}` : `$${costVal.toFixed(3)}`}
        </span>
      )}
      <span style={{ fontSize: 10, color: C.textDim, whiteSpace: 'nowrap' }}>{when}</span>
    </div>
  )
}

function activityIcon(type: string): string {
  switch (type) {
    case 'login': return '🔐'
    case 'scene_generated': return '🎬'
    case 'scene_status_changed': return '✓'
    case 'scene_deleted': return '🗑'
    case 'image_generated': return '🖼'
    case 'asset_saved': return '⭐'
    case 'asset_deleted': return '🗑'
    case 'asset_promoted': return '⬆'
    case 'scene_director_called': return '✨'
    case 'image_director_called': return '✨'
    case 'project_created': return '📁'
    case 'episode_created': return '📺'
    case 'user_created': return '👤'
    default: return '•'
  }
}

function activityDescription(event: ActivityEventView): string {
  const t = event.type
  const m = event.meta
  if (t === 'login') return 'fez login'
  if (t === 'scene_generated') return `gerou cena ${m.duration ? m.duration + 's' : ''} (${m.engineId ?? '?'})`
  if (t === 'scene_status_changed') return `mudou status: ${m.oldStatus ?? '?'} → ${m.newStatus}`
  if (t === 'scene_deleted') return `deletou cena ${m.label ? '"' + m.label + '"' : ''}`
  if (t === 'image_generated') return `gerou ${m.variations ?? 1} imagem${(m.variations ?? 1) > 1 ? 's' : ''} (${m.engineId ?? '?'})`
  if (t === 'asset_saved') return `salvou ${m.assetType ?? 'asset'} "${m.label ?? '?'}"`
  if (t === 'asset_deleted') return `deletou ${m.assetType ?? 'asset'} ${m.label ? '"' + m.label + '"' : ''}`
  if (t === 'asset_promoted') return `promoveu rascunho "${m.label ?? '?'}"`
  if (t === 'scene_director_called') return `usou o Scene Director`
  if (t === 'image_director_called') return `usou o Image Director (${m.assetType ?? '?'})`
  if (t === 'project_created') return `criou projeto "${m.label ?? '?'}"`
  if (t === 'episode_created') return `criou episódio "${m.label ?? '?'}"`
  if (t === 'user_created') return `criou usuário ${m.label ?? m.targetUserId ?? '?'}`
  return t
}

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s atrás`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}min atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d atrás`
  return date.toLocaleDateString('pt-BR')
}

/* Modal: Convidar criador */
/* InviteUserModal extraído para studio/modals/InviteUserModal.tsx (M6-PR6). */

/* Modal: entrega final de episódio — upload MP4 ou review */
function EpisodeDeliveryModal({
  episode,
  currentUser,
  onClose,
  onUpdated,
}: {
  episode: Episode
  currentUser: CurrentUser | null
  onClose: () => void
  onUpdated: (updated: Episode) => void
}) {
  const [creatorNote, setCreatorNote] = useState(episode.creatorNote ?? '')
  const [reviewNote, setReviewNote] = useState(episode.reviewNote ?? '')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'
  const hasDelivery = !!episode.finalVideoUrl

  const handleFile = (f: File) => {
    if (!f.type.startsWith('video/')) {
      setStatus('⚠ Selecione um arquivo de vídeo (MP4, MOV, WebM).')
      return
    }
    const sizeMB = f.size / (1024 * 1024)
    if (sizeMB > 500) {
      setStatus(`⚠ Arquivo muito grande (${sizeMB.toFixed(1)} MB). Máximo: 500 MB.`)
      return
    }
    setPendingFile(f)
    setStatus(`Arquivo pronto: ${f.name} · ${sizeMB.toFixed(1)} MB`)
  }

  const submitUpload = async () => {
    if (!pendingFile) { setStatus('Selecione um arquivo primeiro.'); return }
    setUploading(true); setProgress(0); setStatus('Fazendo upload direto pro Blob...')
    try {
      const { upload } = await import('@vercel/blob/client')
      const filename = `episode-${episode.id}-${Date.now()}.mp4`
      const blob = await upload(filename, pendingFile, {
        access: 'public',
        handleUploadUrl: '/api/blob-client-upload',
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      })
      setStatus('Upload completo. Registrando entrega...')
      // Notifica o backend que a entrega foi enviada
      const res = await fetch(`/api/episodes/${encodeURIComponent(episode.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload_delivery',
          finalVideoUrl: blob.url,
          finalVideoSizeMB: Math.round(pendingFile.size / (1024 * 1024) * 10) / 10,
          creatorNote: creatorNote.trim() || undefined,
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || `Erro ${res.status}`) }
      const updated = await res.json() as Episode
      setStatus('✓ Entrega enviada! Admin foi notificado.')
      onUpdated(updated)
      window.setTimeout(() => onClose(), 1200)
    } catch (err) {
      setStatus(err instanceof Error ? '✕ ' + err.message : 'Erro no upload.')
    } finally {
      setUploading(false)
    }
  }

  const submitReview = async (finalStatus: 'approved' | 'needs_changes') => {
    setStatus('Registrando revisão...')
    try {
      const res = await fetch(`/api/episodes/${encodeURIComponent(episode.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'review',
          finalStatus,
          reviewNote: reviewNote.trim() || undefined,
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || `Erro ${res.status}`) }
      const updated = await res.json() as Episode
      setStatus(finalStatus === 'approved' ? '✓ Aprovado!' : '🟠 Ajustes solicitados.')
      onUpdated(updated)
      window.setTimeout(() => onClose(), 800)
    } catch (err) {
      setStatus(err instanceof Error ? '✕ ' + err.message : 'Erro na revisão.')
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, width: '100%', maxWidth: 680, maxHeight: '92vh', overflow: 'auto', padding: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, letterSpacing: '0.5px' }}>ENTREGA FINAL</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginTop: 2 }}>
              {episode.name || '(sem nome)'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textDim, fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {/* Se já tem entrega, mostra o player */}
        {hasDelivery && episode.finalVideoUrl && (
          <div style={{ marginBottom: 18 }}>
            <video src={episode.finalVideoUrl} controls style={{ width: '100%', borderRadius: 10, background: '#000' }} />
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span>📦 {episode.finalVideoSizeMB} MB</span>
              {episode.finalVideoUploadedAt && <span>📤 {new Date(episode.finalVideoUploadedAt).toLocaleString('pt-BR')}</span>}
              {episode.finalVideoUploadedBy && <span>por {episode.finalVideoUploadedBy}</span>}
              <span style={{ color: episode.finalStatus === 'approved' ? C.green : episode.finalStatus === 'needs_changes' ? C.gold : C.purple, fontWeight: 700 }}>
                {episode.finalStatus === 'approved' ? '✓ Aprovado' : episode.finalStatus === 'needs_changes' ? '🟠 Precisa ajustes' : '🟡 Aguardando revisão'}
              </span>
            </div>

            {/* Nota do creator (se houver) */}
            {episode.creatorNote && (
              <div style={{ marginTop: 10, padding: '10px 14px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, color: C.text }}>
                <strong style={{ color: C.purple }}>Criador:</strong> &ldquo;{episode.creatorNote}&rdquo;
              </div>
            )}

            {/* Nota do admin (se houver) */}
            {episode.reviewNote && (
              <div style={{ marginTop: 8, padding: '10px 14px', background: `${C.gold}10`, border: `1px solid ${C.gold}40`, borderRadius: 8, fontSize: 12, color: C.text }}>
                <strong style={{ color: C.gold }}>Admin:</strong> &ldquo;{episode.reviewNote}&rdquo;
              </div>
            )}
          </div>
        )}

        {/* BRANCH A: Admin revisando uma entrega pendente */}
        {isAdmin && hasDelivery && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 8, letterSpacing: '0.5px' }}>REVISÃO DO ADMIN</div>
            <textarea
              value={reviewNote}
              onChange={e => setReviewNote(e.target.value)}
              placeholder="Nota opcional pro criador (ex: 'Música muito alta no primeiro minuto, abaixa pra -6dB')"
              style={{ width: '100%', minHeight: 80, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => submitReview('needs_changes')} style={{ flex: 1, background: `${C.gold}20`, border: `1px solid ${C.gold}60`, borderRadius: 10, padding: '11px', cursor: 'pointer', color: C.gold, fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
                ↺ Pedir ajustes
              </button>
              <button onClick={() => submitReview('approved')} style={{ flex: 1, background: C.green, border: `1px solid ${C.green}`, borderRadius: 10, padding: '11px', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
                ✓ Aprovar entrega
              </button>
            </div>
          </div>
        )}

        {/* BRANCH B: Creator enviando (nova ou re-envio) */}
        {(!isAdmin || !hasDelivery) && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 8, letterSpacing: '0.5px' }}>
              {hasDelivery ? 'ENVIAR NOVA VERSÃO' : 'ENVIAR ENTREGA'}
            </div>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>
              Depois de montar o episódio no CapCut/Premiere e exportar como MP4, selecione o arquivo e envie. Máximo 500 MB.
            </div>

            <button
              onClick={() => fileInput.current?.click()}
              style={{ width: '100%', background: C.card, border: `1px dashed ${C.purple}60`, borderRadius: 10, padding: '22px', cursor: 'pointer', color: C.purple, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', marginBottom: 12 }}
            >
              {pendingFile ? `📹 ${pendingFile.name}` : '📁 Selecionar arquivo MP4 do computador'}
            </button>
            <input ref={fileInput} type="file" accept="video/mp4,video/mov,video/quicktime,video/webm" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

            <textarea
              value={creatorNote}
              onChange={e => setCreatorNote(e.target.value)}
              placeholder="Notas pro admin (opcional). Ex: 'Adicionei música de fundo e a vinheta. Em dúvida sobre o corte dos 2:15.'"
              style={{ width: '100%', minHeight: 70, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 10 }}
            />

            {uploading && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ height: 6, background: C.card, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: C.purple, transition: 'width 0.2s' }} />
                </div>
                <div style={{ fontSize: 10, color: C.textDim, textAlign: 'center', marginTop: 4 }}>{progress.toFixed(0)}%</div>
              </div>
            )}

            <button
              onClick={submitUpload}
              disabled={!pendingFile || uploading}
              style={{ width: '100%', background: (!pendingFile || uploading) ? C.card : C.purple, border: `1px solid ${(!pendingFile || uploading) ? C.border : C.purple}`, borderRadius: 10, padding: '13px', cursor: (!pendingFile || uploading) ? 'not-allowed' : 'pointer', color: (!pendingFile || uploading) ? C.textDim : '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}
            >
              {uploading ? '⟳ Enviando...' : '📤 Enviar para revisão'}
            </button>
          </div>
        )}

        {status && (
          <div style={{ marginTop: 12, fontSize: 12, color: C.textDim, textAlign: 'center' }}>{status}</div>
        )}
      </div>
    </div>
  )
}

/* Modal: exibe credenciais one-time após criar user */
/* NewUserCredsModal extraído para studio/modals/NewUserCredsModal.tsx (M4-PR6). */

export function AAZStudio() {
  const router = useRouter()

  /* tabs */
  const [tab, setTab] = useState('studio')

  // Filtro "Meus" vs "Equipe" para assets e cenas
  const [assetOwnerFilter, setAssetOwnerFilter] = useState<'mine' | 'team' | 'all'>('mine')
  const [showSheetWizard, setShowSheetWizard] = useState(false)
  const [cantigaLeaveWarning, setCantigaLeaveWarning] = useState<string | null>(null) // tab destino

  /* Sessão atual (quem tá logado) — admin vê aba extra */
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [myBudget, setMyBudget] = useState<{ usedUsd: number; capUsd?: number; percentageUsed?: number } | null>(null)
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { if (data.user) setCurrentUser(data.user) })
      .catch(() => {})
  }, [])
  const isAdminUser = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  // Permission helpers (Phase 4) — derived from currentUser.permissions
  const canGenerateVideo = !currentUser || hasPermission(currentUser.permissions, currentUser.role, PERMISSIONS.GENERATE_VIDEO)
  const canGenerateImage = !currentUser || hasPermission(currentUser.permissions, currentUser.role, PERMISSIONS.GENERATE_IMAGE)
  const canUseSceneDirector = !currentUser || hasPermission(currentUser.permissions, currentUser.role, PERMISSIONS.USE_SCENE_DIRECTOR)
  const canUseImageDirector = !currentUser || hasPermission(currentUser.permissions, currentUser.role, PERMISSIONS.USE_IMAGE_DIRECTOR)
  const canManageEpisodes = !currentUser || hasPermission(currentUser.permissions, currentUser.role, PERMISSIONS.MANAGE_EPISODES)
  const canManageAssets = !currentUser || hasPermission(currentUser.permissions, currentUser.role, PERMISSIONS.MANAGE_ASSETS)

  // Carrega budget do creator (admin/super_admin não tem cap)
  const loadMyBudget = useCallback(async () => {
    if (!currentUser || currentUser.role === 'admin' || currentUser.role === 'super_admin') return
    try {
      const res = await fetch('/api/me/budget')
      if (res.ok) setMyBudget(await res.json())
    } catch { /* silent */ }
  }, [currentUser])
  useEffect(() => { loadMyBudget() }, [loadMyBudget])

  // Carrega wallet da org do usuário
  const [myWallet, setMyWallet] = useState<WalletInfo | null>(null)
  const loadMyWallet = useCallback(async () => {
    if (!currentUser) return
    try {
      const res = await fetch('/api/me/wallet')
      if (res.ok) {
        const data = await res.json()
        if (data.wallet === null) { setMyWallet(null); return }
        setMyWallet(data as WalletInfo)
      }
    } catch { /* silent */ }
  }, [currentUser])
  useEffect(() => { loadMyWallet() }, [loadMyWallet])

  // Client pricing — preços da pricing table (com margem do Super Admin)
  const [clientPrices, setClientPrices] = useState<Record<string, number>>({})
  useEffect(() => {
    fetch('/api/pricing').then(r => r.json()).then(d => {
      const map: Record<string, number> = {}
      for (const p of (d.prices ?? [])) map[p.engineId] = p.pricePerUnit
      setClientPrices(map)
    }).catch(() => {})
  }, [])
  // Helper: retorna preço do cliente ou fallback do hardcoded
  const cp = (engineId: string, fallback: number) => clientPrices[engineId] ?? fallback

  // BRL conversion toggle
  const [showBrl, setShowBrl] = useState(true) // BRL ativo por padrão
  const [brlRate, setBrlRate] = useState<number | null>(null)
  // Auto-fetch BRL rate no mount
  useEffect(() => {
    fetch('/api/currency').then(r => r.json()).then(d => { if (d.rate) setBrlRate(d.rate) }).catch(() => {})
  }, [])
  const toggleBrl = useCallback(async () => {
    if (!showBrl && brlRate === null) {
      try {
        const res = await fetch('/api/currency')
        if (res.ok) {
          const data = await res.json()
          if (data.rate) setBrlRate(data.rate)
        }
      } catch { /* silent */ }
    }
    setShowBrl(v => !v)
  }, [showBrl, brlRate])

  // Wallet extrato modal
  const [showExtrato, setShowExtrato] = useState(false)

  /* ═══════════ ATELIER — geração de assets de imagem ═══════════ */
  const [atAssets, setAtAssets] = useState<Asset[]>([])
  const [atDrafts, setAtDrafts] = useState<Asset[]>([])
  const [atLoading, setAtLoading] = useState(false)
  const [atType, setAtType] = useState<AssetType>('character')
  /* Atelier: agora só tem o workflow de Criar — Biblioteca e Rascunhos
     moraram pra aba Assets (organização melhor). Removido atSubTab. */
  /* form */
  const [atName, setAtName] = useState('')
  const [atId, setAtId] = useState('')
  const [atIdEdited, setAtIdEdited] = useState(false)
  const [atDesc, setAtDesc] = useState('')
  const [atEngineId, setAtEngineId] = useState<string>(DEFAULT_IMAGE_ENGINE_ID)
  const [atMood, setAtMood] = useState<MoodId>(DEFAULT_MOOD_ID)
  const [atVariations, setAtVariations] = useState(4)
  const [atRefUrl, setAtRefUrl] = useState('')
  const [atRefining, setAtRefining] = useState(false)
  const [atGenerating, setAtGenerating] = useState(false)
  const [atStatus, setAtStatus] = useState('')
  const [atResults, setAtResults] = useState<string[]>([])
  const [atSelected, setAtSelected] = useState<Set<number>>(new Set())
  const [atTags, setAtTags] = useState<string[]>([])
  const [atLastSaved, setAtLastSaved] = useState<{ id: string; name: string; type: AssetType; imageUrl: string } | null>(null)
  const atRefInput = useRef<HTMLInputElement>(null)

  const atEngine = useMemo(() => getImageEngine(atEngineId), [atEngineId])
  const atTotalCost = (cp(atEngine.id, atEngine.pricePerImage) * atVariations).toFixed(2)

  const loadAssets = useCallback(async (type?: AssetType) => {
    setAtLoading(true)
    try {
      const params = new URLSearchParams()
      if (type) params.set('type', type)
      params.set('drafts', '1')
      const res = await fetch(`/api/assets?${params.toString()}`)
      if (res.ok) {
        const data = await res.json() as { assets: Asset[]; drafts: Asset[] }
        setAtAssets(data.assets ?? [])
        setAtDrafts(data.drafts ?? [])
      }
    } catch { /* silent */ }
    finally { setAtLoading(false) }
  }, [])

  // Carrega assets uma vez na montagem (pra @mention + scene strip funcionarem no Estúdio)
  useEffect(() => { loadAssets() }, [loadAssets])
  // Recarrega quando muda o tipo dentro do Atelier
  useEffect(() => {
    if (tab === 'atelier') loadAssets(atType)
  }, [tab, atType, loadAssets])

  // Auto-slug quando o nome muda (a menos que o usuário tenha editado o id manualmente)
  useEffect(() => {
    if (!atIdEdited) setAtId(slugify(atName))
  }, [atName, atIdEdited])

  /* biblioteca — Vercel KV */
  const [library, setLibrary] = useState<Record<string, LibraryEntry>>({})

  const loadLibrary = useCallback(async () => {
    try {
      const res = await fetch('/api/library')
      if (res.ok) setLibrary(await res.json())
    } catch { /* silently fallback to empty */ }
  }, [])

  useEffect(() => { loadLibrary() }, [loadLibrary])

  const saveToKV = async (entry: LibraryEntry) => {
    try { await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) }) } catch {}
  }
  const deleteFromKV = async (charId: string) => {
    try { await fetch(`/api/library/${encodeURIComponent(charId)}`, { method: 'DELETE' }) } catch {}
  }

  /* character reference uploader */
  const [sheetChar, setSheetChar] = useState<Character | null>(null)
  const [sheetPhotos, setSheetPhotos] = useState<{ url: string; name: string }[]>([])

  const addSheetPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5 - sheetPhotos.length)
    for (const f of files) { const url = await toDataUrl(f); setSheetPhotos(p => [...p, { url, name: f.name }]) }
  }

  const saveCharRefs = async () => {
    if (!sheetChar || !sheetPhotos.length) return
    const entry: LibraryEntry = {
      charId: sheetChar.id, name: sheetChar.name, emoji: sheetChar.emoji,
      images: sheetPhotos.map(p => p.url), createdAt: new Date().toLocaleDateString('pt-BR'),
    }
    setLibrary(prev => ({ ...prev, [sheetChar.id]: entry }))
    await saveToKV(entry)
    setSheetPhotos([]); setSheetChar(null)
  }

  /* scenarios — persisted to KV */
  const [scenarios, setScenarios] = useState<ScenarioEntry[]>([])
  const [scenarioName, setScenarioName] = useState('')
  const [scenarioPhoto, setScenarioPhoto] = useState<{ url: string; name: string } | null>(null)

  const loadScenarios = useCallback(async () => {
    try { const r = await fetch('/api/scenarios'); if (r.ok) setScenarios(await r.json()) } catch {}
  }, [])

  const addScenarioPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { const url = await toDataUrl(f); setScenarioPhoto({ url, name: f.name }) }
  }

  const saveScenario = async () => {
    if (!scenarioName.trim() || !scenarioPhoto) return
    const entry: ScenarioEntry = { id: `scenario_${Date.now()}`, name: scenarioName, imageUrl: scenarioPhoto.url, createdAt: new Date().toLocaleDateString('pt-BR') }
    setScenarios(p => [...p, entry])
    setScenarioName(''); setScenarioPhoto(null)
    try { await fetch('/api/scenarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) }) } catch {}
  }

  const deleteScenario = async (id: string) => {
    setScenarios(p => p.filter(s => s.id !== id))
    try { await fetch(`/api/scenarios/${encodeURIComponent(id)}`, { method: 'DELETE' }) } catch {}
  }

  /* projects */
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [showNewProjectInput, setShowNewProjectInput] = useState(false)

  const loadProjects = useCallback(async () => {
    try { const r = await fetch('/api/projects'); if (r.ok) setProjects(await r.json()) } catch {}
  }, [])

  const createProject = async () => {
    if (!newProjectName.trim()) return
    const p: Project = { id: `prj_${Date.now()}`, name: newProjectName.trim(), createdAt: new Date().toISOString() }
    setProjects(prev => [...prev, p])
    setCurrentProject(p)
    setNewProjectName('')
    setShowNewProjectInput(false)
    try { await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }) } catch {}
  }

  /* episodes */
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null)
  const [newEpName, setNewEpName] = useState('')
  const [newEpError, setNewEpError] = useState('')

  const loadEpisodes = useCallback(async () => {
    try { const r = await fetch('/api/episodes'); if (r.ok) { const eps = await r.json(); setEpisodes(eps); if (eps.length && !currentEpisode) setCurrentEpisode(eps[0]) } } catch {}
  }, [currentEpisode])

  const createEpisode = async () => {
    const trimmed = newEpName.trim()
    if (!trimmed) {
      setNewEpError('Digite o nome do episódio antes de criar.')
      setTimeout(() => setNewEpError(''), 3000)
      return
    }
    setNewEpError('')
    const ep: Episode = {
      id: `ep_${Date.now()}`,
      name: trimmed,
      projectId: currentProject?.id ?? null,
      createdAt: new Date().toISOString()
    }
    setEpisodes(p => [...p, ep]); setCurrentEpisode(ep); setNewEpName('')
    try { await fetch('/api/episodes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ep) }) } catch {}
  }

  /* Move episódio para outro projeto (ou para nenhum) */
  const moveEpisode = async (episodeId: string, newProjectId: string | null) => {
    setEpisodes(p => p.map(e => e.id === episodeId ? { ...e, projectId: newProjectId } : e))
    try {
      await fetch(`/api/episodes/${encodeURIComponent(episodeId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: newProjectId })
      })
    } catch {}
  }

  /* Renomeia um episódio (inline edit) */
  const renameEpisode = async (episodeId: string, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed) return
    setEpisodes(p => p.map(e => e.id === episodeId ? { ...e, name: trimmed } : e))
    try {
      await fetch(`/api/episodes/${encodeURIComponent(episodeId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      })
    } catch {}
  }

  /* Move cena para outro episódio (ou para nenhum) — atualiza também projectId */
  const moveScene = async (sceneId: string, newEpisodeId: string | null, newProjectId: string | null) => {
    setSceneAssets(prev => prev.map(s => s.id === sceneId ? { ...s, episodeId: newEpisodeId, projectId: newProjectId } : s))
    try {
      await fetch(`/api/scenes/${encodeURIComponent(sceneId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeId: newEpisodeId, projectId: newProjectId })
      })
    } catch {}
  }

  /* Atualiza o status de uma cena (draft / approved / rejected) */
  const updateSceneStatus = async (sceneId: string, newStatus: SceneStatus) => {
    setSceneAssets(prev => prev.map(s => s.id === sceneId ? { ...s, status: newStatus } : s))
    try {
      await fetch(`/api/scenes/${encodeURIComponent(sceneId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
    } catch {}
  }

  /**
   * Reordena uma cena dentro do mesmo episódio.
   * Move a cena com sceneId para a posição targetIndex (0-based) na
   * lista ordenada por sceneNumber. Reatribui os números de cena
   * de 1 a N sequencialmente e persiste todas as mudanças.
   */
  const reorderScene = async (sceneId: string, targetIndex: number) => {
    const scene = sceneAssets.find(s => s.id === sceneId)
    if (!scene) return
    // Pega todas as cenas do mesmo episódio ordenadas
    const siblings = sceneAssets
      .filter(s => s.episodeId === scene.episodeId)
      .sort((a, b) => a.sceneNumber - b.sceneNumber)
    const fromIndex = siblings.findIndex(s => s.id === sceneId)
    if (fromIndex === -1) return
    // Ajusta targetIndex se estiver fora dos limites
    let to = Math.max(0, Math.min(targetIndex, siblings.length - 1))
    if (fromIndex === to) return
    // Move a cena
    const reordered = [...siblings]
    const [moved] = reordered.splice(fromIndex, 1)
    // Se estava sendo removida antes do target, diminui to em 1 pra compensar
    if (fromIndex < to) to = to - 1
    reordered.splice(to, 0, moved)
    // Reatribui sceneNumber
    const updates: { id: string; sceneNumber: number }[] = []
    reordered.forEach((s, i) => {
      const newNumber = i + 1
      if (s.sceneNumber !== newNumber) {
        updates.push({ id: s.id, sceneNumber: newNumber })
      }
    })
    // Atualiza state otimista
    setSceneAssets(prev => prev.map(s => {
      const upd = updates.find(u => u.id === s.id)
      return upd ? { ...s, sceneNumber: upd.sceneNumber } : s
    }))
    // Persiste no backend (paralelo)
    await Promise.all(updates.map(u =>
      fetch(`/api/scenes/${encodeURIComponent(u.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneNumber: u.sceneNumber })
      }).catch(() => {})
    ))
  }

  /* State de drag-and-drop da faixa contextual */
  const [draggingSceneId, setDraggingSceneId] = useState<string | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  /* episodes filtrados pelo projeto selecionado */
  const filteredEpisodes = currentProject
    ? episodes.filter(e => e.projectId === currentProject.id)
    : episodes

  const deleteEpisode = async (id: string) => {
    setEpisodes(p => p.filter(e => e.id !== id))
    if (currentEpisode?.id === id) setCurrentEpisode(episodes.find(e => e.id !== id) ?? null)
    setSceneAssets(p => p.filter(s => s.episodeId !== id))
    try { await fetch(`/api/episodes/${encodeURIComponent(id)}`, { method: 'DELETE' }) } catch {}
  }

  /* scene assets — persisted to KV */
  const [sceneAssets, setSceneAssets] = useState<SceneAsset[]>([])

  const loadScenes = useCallback(async () => {
    try {
      const r = await fetch('/api/scenes')
      if (!r.ok) return
      const data = await r.json() as SceneAsset[]
      // Filtra cenas com URLs mortas (URLs blob: de antes da persistência no Vercel Blob)
      const valid: SceneAsset[] = []
      const brokenIds: string[] = []
      for (const s of data) {
        if (s.videoUrl && !s.videoUrl.startsWith('blob:')) {
          valid.push(s)
        } else {
          brokenIds.push(s.id)
        }
      }
      setSceneAssets(valid)
      // Limpa cenas órfãs do Redis silenciosamente
      for (const id of brokenIds) {
        fetch(`/api/scenes/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
      }
      if (brokenIds.length) console.log(`[loadScenes] ${brokenIds.length} cenas com URLs mortas removidas`)
    } catch {}
  }, [])

  /* load all data */
  useEffect(() => { loadProjects(); loadScenarios(); loadEpisodes(); loadScenes() }, [loadProjects, loadScenarios, loadEpisodes, loadScenes])

  // Assets e cenas filtrados pelo owner
  const myId = currentUser?.id
  const filteredSceneAssets = useMemo(() => {
    if (assetOwnerFilter === 'all' || !myId) return sceneAssets
    if (assetOwnerFilter === 'mine') return sceneAssets.filter(s => s.createdBy === myId || !s.createdBy)
    return sceneAssets.filter(s => s.createdBy && s.createdBy !== myId) // team
  }, [sceneAssets, assetOwnerFilter, myId])

  // Library filtrada: no modo "mine", só usa sheets que EU criei para auto-inject
  const filteredLibrary = useMemo(() => {
    if (assetOwnerFilter === 'all' || !myId) return library
    const filtered: Record<string, LibraryEntry> = {}
    for (const [k, v] of Object.entries(library)) {
      if (assetOwnerFilter === 'mine' && (v.createdBy === myId || !v.createdBy)) filtered[k] = v
      else if (assetOwnerFilter === 'team' && v.createdBy && v.createdBy !== myId) filtered[k] = v
    }
    return filtered
  }, [library, assetOwnerFilter, myId])

  const filteredAtAssets = useMemo(() => {
    if (assetOwnerFilter === 'all' || !myId) return atAssets
    if (assetOwnerFilter === 'mine') return atAssets.filter(a => a.isOfficial || a.createdBy === myId || !a.createdBy)
    return atAssets.filter(a => a.isOfficial || (a.createdBy && a.createdBy !== myId)) // team
  }, [atAssets, assetOwnerFilter, myId])

  /* Migração silenciosa: converte base64 antigos para URLs do Blob ── roda uma vez só */
  const [migrationDone, setMigrationDone] = useState(false)
  useEffect(() => {
    if (migrationDone) return
    const hasBase64Char = Object.values(library).some(e => e.images?.some(img => img.startsWith('data:')))
    const hasBase64Scenario = scenarios.some(s => s.imageUrl?.startsWith('data:'))
    if (!hasBase64Char && !hasBase64Scenario) {
      if (Object.keys(library).length > 0 || scenarios.length > 0) setMigrationDone(true)
      return
    }
    // Pelo menos um ainda é base64 — migra
    ;(async () => {
      try {
        console.log('[migration] Convertendo base64 → Blob URLs...')

        // Migra personagens
        for (const entry of Object.values(library)) {
          const needsMigration = entry.images.some(img => img.startsWith('data:'))
          if (!needsMigration) continue
          const newImages: string[] = []
          for (const img of entry.images) {
            if (img.startsWith('data:')) {
              try {
                const blob = await (await fetch(img)).blob()
                const url = await uploadBlob(blob, `char-${entry.charId}-${Date.now()}.${blob.type.split('/')[1] || 'jpg'}`)
                newImages.push(url)
              } catch (e) {
                console.warn('[migration] Falha em imagem do personagem', entry.charId, e)
                newImages.push(img) // mantém base64 se falhar
              }
            } else {
              newImages.push(img)
            }
          }
          const updated = { ...entry, images: newImages }
          setLibrary(prev => ({ ...prev, [entry.charId]: updated }))
          await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
        }

        // Migra cenários
        for (const sc of scenarios) {
          if (!sc.imageUrl?.startsWith('data:')) continue
          try {
            const blob = await (await fetch(sc.imageUrl)).blob()
            const url = await uploadBlob(blob, `scenario-${sc.id}.${blob.type.split('/')[1] || 'jpg'}`)
            const updated = { ...sc, imageUrl: url }
            setScenarios(prev => prev.map(s => s.id === sc.id ? updated : s))
            await fetch('/api/scenarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) })
          } catch (e) {
            console.warn('[migration] Falha em cenário', sc.id, e)
          }
        }

        console.log('[migration] Concluída')
        setMigrationDone(true)
      } catch (err) {
        console.error('[migration]', err)
        setMigrationDone(true)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library, scenarios])

  /* Se o episódio selecionado não pertence ao projeto atual, desseleciona */
  useEffect(() => {
    if (currentProject && currentEpisode && currentEpisode.projectId !== currentProject.id) {
      setCurrentEpisode(null)
    }
  }, [currentProject, currentEpisode])

  const [libTab, setLibTab] = useState<'chars' | 'scenarios' | 'props' | 'scenes' | 'drafts'>('chars')

  /* scene director — compartilhado entre modo inline (Estúdio) e aba separada (legada) */
  const [sdDesc, setSdDesc] = useState('')
  const [sdSetting, setSdSetting] = useState('')
  const [sdEmotion, setSdEmotion] = useState('')
  const [sdMood, setSdMood] = useState<MoodId>(DEFAULT_MOOD_ID)
  const [sdStatus, setSdStatus] = useState('idle')
  const [sdMsg, setSdMsg] = useState('')

  /* Mention @ no textarea do Assistente */
  const sdDescRef = useRef<HTMLTextAreaElement>(null)
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [mention, setMention] = useState<{ start: number; query: string; highlightIdx: number; dir: 'up' | 'down' } | null>(null)
  const [promptMention, setPromptMention] = useState<{ start: number; query: string; highlightIdx: number; dir: 'up' | 'down' } | null>(null)

  // Decide se o dropdown cabe abaixo do textarea ou precisa aparecer acima
  const computeDropdownDirection = (el: HTMLTextAreaElement | null, dropdownHeight = 280): 'up' | 'down' => {
    if (!el) return 'down'
    const rect = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    // Se não cabe abaixo mas cabe acima, abre pra cima
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) return 'up'
    return 'down'
  }

  // Dado o conteúdo atual e a posição do cursor, detecta se o usuário
  // está digitando um mention @xxx. Retorna { start, query } ou null.
  const detectMention = (text: string, cursor: number) => {
    // Procura o último @ antes do cursor
    let i = cursor - 1
    while (i >= 0) {
      const ch = text[i]
      if (ch === '@') {
        // Achou. Garante que @ está no início do texto ou depois de um espaço
        if (i === 0 || /\s/.test(text[i - 1])) {
          const query = text.slice(i + 1, cursor)
          // Se a query contém espaço, já não é mais mention
          if (/\s/.test(query)) return null
          return { start: i, query }
        }
        return null
      }
      if (/\s/.test(ch)) return null
      i--
    }
    return null
  }

  // Item comum renderizado no dropdown de @ mention.
  // Pode vir de um lead oficial, de um custom asset, ou ser uma opção
  // "+ criar" que abre o modal Quick-Create.
  type MentionItem = {
    id: string
    name: string
    emoji: string
    color: string
    type: AssetType
    isOfficial: boolean
    hasRefs: boolean
    refUrls: string[]
    desc: string
    kind: 'existing' | 'create'
  }

  // Monta a lista de matches pro @ mention combinando leads + custom assets
  // + opção "criar novo" quando há query. Prioriza itens com refs.
  const buildMentionMatches = useCallback((query: string): MentionItem[] => {
    const q = query.toLowerCase()
    const results: MentionItem[] = []

    // Leads (CHARACTERS fixos) — buscando em id OU name
    for (const c of CHARACTERS) {
      if (q && !c.id.toLowerCase().startsWith(q) && !c.name.toLowerCase().startsWith(q)) continue
      const libRefs = library[c.id]?.images ?? []
      // Também verifica se tem um override no Redis com imageUrls extras
      const override = atAssets.find(a => a.id === c.id && a.type === 'character' && a.isOfficial)
      const assetRefs = override?.imageUrls ?? []
      const refUrls = Array.from(new Set([...libRefs, ...assetRefs]))
      results.push({
        id: c.id, name: c.name, emoji: c.emoji, color: c.color,
        type: 'character', isOfficial: true,
        hasRefs: refUrls.length > 0, refUrls,
        desc: c.desc,
        kind: 'existing',
      })
    }

    // Custom assets (não-leads, qualquer tipo)
    for (const a of atAssets) {
      if (a.isOfficial) continue
      if (q && !a.id.toLowerCase().startsWith(q) && !a.name.toLowerCase().startsWith(q)) continue
      const color = a.type === 'character' ? C.purple : a.type === 'scenario' ? C.blue : C.gold
      results.push({
        id: a.id, name: a.name,
        emoji: a.emoji ?? defaultEmoji(a.type),
        color,
        type: a.type, isOfficial: false,
        hasRefs: a.imageUrls.length > 0,
        refUrls: a.imageUrls,
        desc: a.description,
        kind: 'existing',
      })
    }

    // Ordena: leads primeiro, depois itens com refs, depois resto
    results.sort((a, b) => {
      if (a.isOfficial !== b.isOfficial) return a.isOfficial ? -1 : 1
      if (a.hasRefs !== b.hasRefs) return a.hasRefs ? -1 : 1
      return 0
    })

    const limited = results.slice(0, 7)

    // Opção "criar novo" — só se a query é não-vazia e não bate exatamente com um existente
    if (q && !results.some(r => r.id === q)) {
      limited.push({
        id: q, name: `Criar "${query}"`,
        emoji: '➕', color: C.green,
        type: 'character', isOfficial: false,
        hasRefs: false, refUrls: [],
        desc: 'Abre o Quick-Create',
        kind: 'create',
      })
    }
    return limited
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library, atAssets])

  // Lista de personagens disponíveis para mention, filtrada por query
  const mentionMatches = useMemo(() => {
    if (!mention) return [] as MentionItem[]
    return buildMentionMatches(mention.query)
  }, [mention, buildMentionMatches])

  const handleSdDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursor = e.target.selectionStart ?? value.length
    setSdDesc(value)
    const detected = detectMention(value, cursor)
    if (detected) {
      const dir = computeDropdownDirection(sdDescRef.current)
      setMention({ start: detected.start, query: detected.query, highlightIdx: 0, dir })
    } else {
      setMention(null)
    }
  }

  // Aplica um MentionItem a um textarea (assistente ou prompt final).
  // Insere @id no texto, injeta refs quando o asset tem imagens, e se
  // for "criar novo" abre o Quick-Create modal.
  const applyMentionItem = (item: MentionItem, ctx: 'sd' | 'prompt') => {
    const state = ctx === 'sd' ? mention : promptMention
    if (!state) return
    const text = ctx === 'sd' ? sdDesc : prompts[lang]
    const id = item.kind === 'create' ? slugify(item.id) : item.id
    const before = text.slice(0, state.start)
    const after = text.slice(state.start + 1 + state.query.length)
    const replacement = `@${id} `
    const newText = before + replacement + after

    if (ctx === 'sd') setSdDesc(newText)
    else setPrompts(p => ({ ...p, [lang]: newText }))

    if (ctx === 'sd') setMention(null)
    else setPromptMention(null)

    // Reposiciona cursor
    window.setTimeout(() => {
      const ta = ctx === 'sd' ? sdDescRef.current : promptTextareaRef.current
      if (ta) {
        const pos = before.length + replacement.length
        ta.focus()
        ta.setSelectionRange(pos, pos)
      }
    }, 0)

    // "+ criar" — abre Quick-Create com nome pré-preenchido
    if (item.kind === 'create') {
      setQuickCreate({ type: 'character', initialName: item.id.replace(/_/g, ' ') })
      return
    }

    // Para tipo character, adiciona ao sidebar de personagens selecionados
    if (item.type === 'character' && !selChars.find(c => c.id === item.id)) {
      setSelChars(p => [...p, {
        id: item.id, name: item.name, emoji: item.emoji, color: item.color, desc: item.desc
      }])
    }

    // Injeta refs se houver
    if (item.refUrls.length > 0) {
      if (mode !== 'omni_reference') setMode('omni_reference')
      setRefImgs(p => {
        const next = [...p]
        for (const url of item.refUrls) {
          if (next.length >= 9) break
          if (next.some(r => r.url === url)) continue
          next.push({ url, label: `@image${next.length + 1}`, name: item.name, fromLib: true, charId: item.id })
        }
        return next
      })
    }
  }

  const selectMention = (item: MentionItem) => applyMentionItem(item, 'sd')

  const handleSdDescKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mention || mentionMatches.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMention(m => m ? { ...m, highlightIdx: (m.highlightIdx + 1) % mentionMatches.length } : m)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMention(m => m ? { ...m, highlightIdx: (m.highlightIdx - 1 + mentionMatches.length) % mentionMatches.length } : m)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      selectMention(mentionMatches[mention.highlightIdx])
    } else if (e.key === 'Escape') {
      setMention(null)
    }
  }

  /* ── Autocomplete @ no textarea do PROMPT final (PT/EN) ── */
  const promptMentionMatches = useMemo(() => {
    if (!promptMention) return [] as MentionItem[]
    return buildMentionMatches(promptMention.query)
  }, [promptMention, buildMentionMatches])

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursor = e.target.selectionStart ?? value.length
    setPrompts(p => ({ ...p, [lang]: value }))
    const detected = detectMention(value, cursor)
    if (detected) {
      const dir = computeDropdownDirection(promptTextareaRef.current)
      setPromptMention({ start: detected.start, query: detected.query, highlightIdx: 0, dir })
    } else {
      setPromptMention(null)
    }
  }

  const selectPromptMention = (item: MentionItem) => applyMentionItem(item, 'prompt')

  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!promptMention || promptMentionMatches.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setPromptMention(m => m ? { ...m, highlightIdx: (m.highlightIdx + 1) % promptMentionMatches.length } : m)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setPromptMention(m => m ? { ...m, highlightIdx: (m.highlightIdx - 1 + promptMentionMatches.length) % promptMentionMatches.length } : m)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      selectPromptMention(promptMentionMatches[promptMention.highlightIdx])
    } else if (e.key === 'Escape') {
      setPromptMention(null)
    }
  }

  const runSceneDirector = async () => {
    if (!sdDesc.trim()) { setSdStatus('error'); setSdMsg('Descreva a cena.'); return }
    setSdStatus('generating'); setSdMsg('Claude está escrevendo os prompts...')
    try {
      // Extrai @nomes do texto (personagens mencionados via autocomplete)
      const mentionRegex = /@(\w+)/g
      const mentionedIds = new Set<string>()
      let match
      while ((match = mentionRegex.exec(sdDesc)) !== null) {
        const id = match[1].toLowerCase()
        if (CHARACTERS.find(c => c.id === id)) mentionedIds.add(id)
      }
      // Une @nomes com os já selecionados no sidebar
      const allCharIdsSet = new Set<string>()
      selChars.forEach(c => allCharIdsSet.add(c.id))
      mentionedIds.forEach(id => allCharIdsSet.add(id))
      const allCharIds = Array.from(allCharIdsSet)

      // Se está encadeando, monta o chain_from pro Claude entender
      // que esta cena é continuação e deve abrir mid-action.
      const chainFromPayload = chainSource ? {
        sceneNumber: chainSource.sceneNumber,
        sceneTitle: chainSource.title,
        // Últimas 400 chars do prompt da cena anterior
        previousPromptTail: chainSource.prompt.slice(-400),
        previousMoodId: chainSource.mood,
        previousEmotion: chainSource.emotion,
        inheritedCharacters: chainSource.characters,
      } : undefined

      const res = await fetch('/api/scene-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene_description: sdDesc,
          characters: allCharIds.length ? allCharIds : undefined,
          setting: sdSetting || undefined,
          duration,
          emotion: sdEmotion || undefined,
          mood: sdMood,
          chain_from: chainFromPayload,
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || `Erro ${res.status}`) }
      const data = await res.json()
      const p = data.prompts as { lang: string; prompt: string }[]
      setPrompts({
        pt: p.find(x => x.lang === 'pt-br')?.prompt ?? '',
        en: p.find(x => x.lang === 'en')?.prompt ?? '',
      })
      setSdStatus('success'); setSdMsg('Prompts gerados!')
    } catch (err: unknown) {
      setSdStatus('error'); setSdMsg(err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }

  /* studio */
  const [selChars, setSelChars] = useState<Character[]>([])
  const [mode, setMode] = useState('text_to_video')
  const [ratio, setRatio] = useState('16:9')
  const [duration, setDuration] = useState(5)
  const [lang, setLang] = useState<'pt' | 'en'>('pt')

  /**
   * Quando troca para modo Omni Reference, injeta automaticamente as
   * imagens dos personagens já selecionados no sidebar direito.
   * Ignora personagens sem entrada na biblioteca.
   */
  useEffect(() => {
    if (mode !== 'omni_reference') return
    if (selChars.length === 0) return
    setRefImgs(p => {
      const next = [...p]
      for (const c of selChars) {
        const entry = library[c.id]
        if (!entry?.images?.length) continue
        for (const img of entry.images) {
          if (next.length >= 9) break
          if (next.some(r => r.url === img)) continue
          next.push({ url: img, label: `@image${next.length + 1}`, name: entry.name, fromLib: true, charId: c.id })
        }
      }
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  /**
   * Sincronização reativa: sempre que o texto dos prompts ou da
   * descrição do Assistente muda, detecta @ids canônicos mencionados
   * e garante que suas imagens estejam no refImgs.
   *
   * Cobre colagem de prompt pronto, edição manual, importação, etc.
   * Se o @id é um personagem com refs na biblioteca e ainda não está
   * no refImgs, é adicionado automaticamente.
   */
  const [prompts, setPrompts] = useState<Record<'pt' | 'en', string>>({ pt: '', en: '' })
  useEffect(() => {
    const combinedText = `${prompts.pt}\n${prompts.en}\n${sdDesc}`
    const mentionRegex = /@(\w+)/g
    const mentionedIds = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = mentionRegex.exec(combinedText)) !== null) {
      const id = m[1].toLowerCase()
      // Ignora tags técnicas já resolvidas
      if (/^image\d+$/.test(id) || /^video\d+$/.test(id) || /^audio\d+$/.test(id)) continue
      if (CHARACTERS.find(c => c.id === id)) mentionedIds.add(id)
    }
    if (mentionedIds.size === 0) return

    const toAdd: Character[] = []
    mentionedIds.forEach(id => {
      const alreadyHas = refImgs.some(r => r.charId === id)
      if (alreadyHas) return
      const entry = library[id]
      if (!entry?.images?.length) return
      const char = CHARACTERS.find(c => c.id === id)
      if (char) toAdd.push(char)
    })

    if (toAdd.length === 0) return

    // Adiciona as imagens dos personagens faltantes
    setRefImgs(p => {
      const next = [...p]
      for (const char of toAdd) {
        const entry = library[char.id]
        if (!entry?.images?.length) continue
        for (const img of entry.images) {
          if (next.length >= 9) break
          if (next.some(r => r.url === img)) continue
          next.push({ url: img, label: `@image${next.length + 1}`, name: char.name, fromLib: true, charId: char.id })
        }
      }
      return next
    })
    // Adiciona ao sidebar (selChars)
    setSelChars(p => {
      const next = [...p]
      for (const char of toAdd) {
        if (!next.find(c => c.id === char.id)) next.push(char)
      }
      return next
    })
    // Garante modo Omni Reference
    if (mode !== 'omni_reference') setMode('omni_reference')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompts.pt, prompts.en, sdDesc, library])

  /* refs omni */
  const [refImgs, setRefImgs] = useState<RefItem[]>([])
  const [refVids, setRefVids] = useState<RefItem[]>([])
  const [refAuds, setRefAuds] = useState<RefItem[]>([])

  /* first/last — agora com upload de imagem */
  const [firstUrl, setFirstUrl] = useState('')
  const [lastUrl, setLastUrl] = useState('')
  const [firstPreview, setFirstPreview] = useState('')
  const [lastPreview, setLastPreview] = useState('')
  const firstFrameRef = useRef<HTMLInputElement>(null)
  const lastFrameRef = useRef<HTMLInputElement>(null)

  /* Player modal */
  const [playerModalScene, setPlayerModalScene] = useState<SceneAsset | null>(null)
  /* Modais de mover */
  const [moveSceneModal, setMoveSceneModal] = useState<SceneAsset | null>(null)
  const [moveEpisodeModal, setMoveEpisodeModal] = useState<Episode | null>(null)

  /* Modal: Adicionar referência ao Omni */
  const [addRefModal, setAddRefModal] = useState<'image' | 'video' | 'audio' | null>(null)
  /* Modal: Quick-Create — gerar asset sem sair do Estúdio */
  const [quickCreate, setQuickCreate] = useState<{ type: AssetType; initialName: string } | null>(null)
  /* Modal: entrega final de episódio (upload MP4 + review pelo admin) */
  const [deliveryModal, setDeliveryModal] = useState<Episode | null>(null)
  /* Modal: Confirmação de exclusão */
  const [confirmModal, setConfirmModal] = useState<{
    title: string
    description?: string
    thumbnailUrl?: string
    confirmLabel?: string
    onConfirm: () => void | Promise<void>
  } | null>(null)
  const askConfirm = (cfg: NonNullable<typeof confirmModal>) => setConfirmModal(cfg)

  /* Modal: Player sequencial (Assistir episódio/projeto) */
  const [sequentialPlayer, setSequentialPlayer] = useState<{ scenes: SceneAsset[]; title: string } | null>(null)

  useEffect(() => {
    const anyModal = playerModalScene || moveSceneModal || moveEpisodeModal || addRefModal || confirmModal || sequentialPlayer || quickCreate || deliveryModal || showExtrato
    if (!anyModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPlayerModalScene(null)
        setMoveSceneModal(null)
        setMoveEpisodeModal(null)
        setAddRefModal(null)
        setConfirmModal(null)
        setSequentialPlayer(null)
        setQuickCreate(null)
        setDeliveryModal(null)
        setShowExtrato(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playerModalScene, moveSceneModal, moveEpisodeModal, addRefModal, confirmModal, sequentialPlayer, quickCreate, deliveryModal, showExtrato])

  const uploadFrame = async (file: File, setter: (v: string) => void, previewSetter: (v: string) => void) => {
    const url = await toDataUrl(file)
    setter(url)
    previewSetter(url)
  }

  /* ── Adicionar referência ao Omni (chamado pelo AddRefModal) ── */
  const addImageRefFromUrl = (url: string, name: string, charId?: string) => {
    if (refImgs.length >= 9) return
    setRefImgs(p => [...p, { url, label: `@image${p.length + 1}`, name, fromLib: true, charId }])
  }
  const addImageRefFromFile = async (file: File) => {
    if (refImgs.length >= 9) return
    const url = await toBlobUrl(file)
    setRefImgs(p => [...p, { url, label: `@image${p.length + 1}`, name: file.name }])
  }
  const addVideoRefFromFile = async (file: File) => {
    if (refVids.length >= 3) return
    const url = await toBlobUrl(file)
    setRefVids(p => [...p, { url, label: `@video${p.length + 1}`, name: file.name }])
  }
  const addAudioRefFromFile = async (file: File) => {
    if (refAuds.length >= 3) return
    const url = await toBlobUrl(file)
    setRefAuds(p => [...p, { url, label: `@audio${p.length + 1}`, name: file.name }])
  }

  /* chain */
  const [chain, setChain] = useState(false)
  const [lastResult, setLastResult] = useState('')
  /* Chain context — cena fonte quando encadeando (pra banner + chain_from no scene director) */
  const [chainSource, setChainSource] = useState<SceneAsset | null>(null)
  const [generateAudio, setGenerateAudio] = useState(true)
  const [promptMode, setPromptMode] = useState<'assistant' | 'free'>('assistant')

  /* Engine de vídeo selecionada */
  const [engineId, setEngineId] = useState<string>(DEFAULT_ENGINE_ID)
  const engine = useMemo(() => getEngine(engineId), [engineId])

  /* Metadados da cena em edição */
  const [sceneNumberInput, setSceneNumberInput] = useState('')
  const [sceneTitleInput, setSceneTitleInput] = useState('')

  /* Edição inline do nome do episódio (apenas na faixa contextual do Estúdio) */
  const [editingEpName, setEditingEpName] = useState(false)
  const [epNameDraft, setEpNameDraft] = useState('')

  /* geração */
  const [generating, setGenerating] = useState(false)
  const [status, setStatus] = useState('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [resultUrl, setResultUrl] = useState('')

  /* histórico */
  const [history, setHistory] = useState<HistoryItem[]>([])

  const imgRef = useRef<HTMLInputElement>(null)
  const vidRef = useRef<HTMLInputElement>(null)
  const audRef = useRef<HTMLInputElement>(null)

  /* Custo calculado com base na engine selecionada (preço estimado) */
  const cost = (duration * cp(engine.id, engine.pricePerSecond)).toFixed(2)
  const totalCost = history.reduce((s, h) => s + parseFloat(h.cost), 0).toFixed(2)

  /* Warnings quando a engine escolhida não suporta uma feature ativa */
  const engineWarnings = useMemo(() => {
    const warns: string[] = []
    if (mode === 'omni_reference') {
      if (!engine.features.omniReference && refImgs.length > 1) {
        warns.push(`${engine.name} não suporta múltiplas referências. Só a primeira imagem será usada.`)
      }
      if (engine.features.omniReference && refImgs.length > engine.features.maxRefImages) {
        warns.push(`${engine.name} aceita no máximo ${engine.features.maxRefImages} imagens. As extras serão ignoradas.`)
      }
      if (!engine.features.referenceVideos && refVids.length > 0) {
        warns.push(`${engine.name} não suporta vídeos de referência. Serão ignorados.`)
      }
      if (!engine.features.referenceAudios && refAuds.length > 0) {
        warns.push(`${engine.name} não suporta áudios de referência. Serão ignorados.`)
      }
    }
    if (mode === 'first_last_frames' && !engine.features.firstLastFrames) {
      warns.push(`${engine.name} não suporta first/last frame.`)
    }
    if (generateAudio && !engine.features.audio) {
      warns.push(`${engine.name} não gera áudio no mesmo pipeline.`)
    }
    if (engine.durations.length && !engine.durations.includes(duration)) {
      warns.push(`${engine.name} aceita apenas durações: ${engine.durations.join('s, ')}s.`)
    }
    if (engine.aspectRatios.length && !engine.aspectRatios.includes(ratio)) {
      warns.push(`${engine.name} aceita apenas ratios: ${engine.aspectRatios.join(', ')}.`)
    }
    return warns
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, mode, refImgs.length, refVids.length, refAuds.length, generateAudio, duration, ratio])

  /* ── helpers ── */
  /**
   * Seleciona/desseleciona um personagem no sidebar direito.
   * Quando o modo é Omni Reference e o personagem tem imagens de referência
   * salvas na Biblioteca, elas são auto-injetadas (ao adicionar) ou
   * removidas (ao tirar). Os labels @imageN são renumerados após remoção.
   */
  const toggleChar = (c: Character) => {
    const isSelected = !!selChars.find(x => x.id === c.id)
    if (isSelected) {
      // Remove do sidebar
      setSelChars(p => p.filter(x => x.id !== c.id))
      // Remove imagens do Omni que vieram desse personagem e renumera
      setRefImgs(p => p.filter(r => r.charId !== c.id).map((r, i) => ({ ...r, label: `@image${i + 1}` })))
    } else {
      // Adiciona no sidebar
      setSelChars(p => [...p, c])
      // Se em Omni Reference e o personagem tem refs na biblioteca, auto-injeta
      if (mode === 'omni_reference') {
        const entry = library[c.id]
        if (entry?.images?.length) {
          setRefImgs(p => {
            const next = [...p]
            for (const img of entry.images) {
              if (next.length >= 9) break
              if (next.some(r => r.url === img)) continue // evita duplicata
              next.push({ url: img, label: `@image${next.length + 1}`, name: entry.name, fromLib: true, charId: c.id })
            }
            return next
          })
        }
      }
    }
  }

  /* ── Upload helpers ──
   * uploadBlob: manda um File direto para /api/blob-upload e retorna a URL pública
   * compressImage: comprime imagem no cliente antes do upload (economiza banda)
   * toBlobUrl: função principal usada em tudo que era toDataUrl antes.
   *            Comprime se for imagem, depois faz upload, retorna URL.
   */
  const uploadBlob = async (file: File | Blob, filename: string): Promise<string> => {
    const fd = new FormData()
    const f = file instanceof File ? file : new File([file], filename, { type: file.type || 'application/octet-stream' })
    fd.append('file', f)
    const res = await fetch('/api/blob-upload', { method: 'POST', body: fd })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error || 'Falha ao fazer upload.')
    }
    const data = await res.json()
    return data.url as string
  }

  /**
   * Força download de uma URL cross-origin (ex: Vercel Blob).
   * O atributo <a download> só funciona same-origin, então precisamos
   * baixar como blob no cliente e disparar click sintético.
   */
  const downloadVideo = async (url: string, filename: string) => {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch (err) {
      console.error('[downloadVideo]', err)
      alert('Falha ao baixar. Tente de novo.')
    }
  }

  const compressImage = (file: File, maxSize = 1200, quality = 0.85): Promise<Blob> => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width, h = img.height
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize }
          else { w = Math.round(w * maxSize / h); h = maxSize }
        }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Compressão falhou')), 'image/jpeg', quality)
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const toBlobUrl = async (file: File, maxSize = 1200): Promise<string> => {
    if (file.type.startsWith('image/')) {
      const compressed = await compressImage(file, maxSize)
      const ext = file.name.split('.').pop() || 'jpg'
      return uploadBlob(compressed, `img-${Date.now()}.${ext}`)
    }
    // Vídeos e áudios sobem direto, sem compressão
    return uploadBlob(file, file.name || `file-${Date.now()}`)
  }

  /**
   * toDataUrl mantido apenas para retrocompatibilidade interna.
   * Novo código deve usar toBlobUrl.
   */
  const toDataUrl = toBlobUrl

  const addRef = async (e: React.ChangeEvent<HTMLInputElement>, type: string, list: RefItem[], setter: React.Dispatch<React.SetStateAction<RefItem[]>>, max: number) => {
    const files = Array.from(e.target.files || [])
    for (const f of files) {
      if (list.length >= max) break
      const url = await toDataUrl(f)
      const idx = list.length + 1
      setter(p => [...p, { url, label: `@${type}${idx}`, name: f.name }])
    }
  }

  const addFromLibrary = (charId: string) => {
    const entry = filteredLibrary[charId] ?? library[charId]
    if (!entry || refImgs.length >= 9) return
    setMode('omni_reference')
    // Injeta no máximo 3 refs por personagem (frontal, ¾, perfil — as mais importantes)
    const maxPerChar = 3
    let added = 0
    for (const img of entry.images) {
      if (added >= maxPerChar || refImgs.length >= 9) break
      added++
      setRefImgs(p => {
        if (p.length >= 9) return p
        return [...p, { url: img, label: `@image${p.length + 1}`, name: `${entry.name}`, fromLib: true, charId }]
      })
    }
  }

  /* Ideia 3: one-click inject any asset */
  const injectScenario = (s: ScenarioEntry) => {
    if (refImgs.length >= 9) return
    setMode('omni_reference')
    const idx = refImgs.length + 1
    setRefImgs(p => [...p, { url: s.imageUrl, label: `@image${idx}`, name: `Cenário · ${s.name}` }])
  }

  /**
   * Encadeia uma cena como continuação da próxima — Opção C completa.
   *
   * O que acontece:
   * 1. Navega pro Estúdio
   * 2. Salva a cena fonte em chainSource (usado pelo banner + chain_from)
   * 3. Ativa modo omni_reference (pra reference_videos funcionar)
   * 4. Injeta o vídeo da cena anterior como @video1 em refVids (push
   *    outros pra @video2/3 — vídeo fonte sempre primeiro)
   * 5. Herda mood, setting e emotion (criador pode sobrescrever)
   * 6. Herda personagens (leads e customs) com refs da biblioteca
   *    injetadas no refImgs
   * 7. Marca chain=true + lastResult pra retrocompat com o
   *    first_frame_url do Seedance
   * 8. Limpa o prompt e descrição do assistente (nova cena começa
   *    do zero narrativamente — só o contexto visual é herdado)
   * 9. Mostra toast + foca o textarea do assistente
   */
  const injectSceneAsFirstFrame = (scene: SceneAsset) => {
    setTab('studio')
    setChainSource(scene)
    setLastResult(scene.videoUrl)
    setChain(true)

    // Mood / setting / emotion herdados (criador edita se quiser)
    if (scene.mood) setSdMood(scene.mood)
    setSdSetting(scene.setting ?? '')
    setSdEmotion(scene.emotion ?? '')

    // Força modo omni pra usar reference_videos
    setMode('omni_reference')

    // Adiciona o vídeo da cena anterior como @video1 (empurra outros)
    setRefVids(prev => {
      const filtered = prev.filter(r => r.url !== scene.videoUrl)
      const next: RefItem[] = [
        { url: scene.videoUrl, label: '@video1', name: `Cena #${scene.sceneNumber}${scene.title ? ' — ' + scene.title : ''}`, fromLib: true, charId: `chain_source_${scene.id}` },
        ...filtered,
      ].slice(0, 3).map((r, i) => ({ ...r, label: `@video${i + 1}` }))
      return next
    })

    // Herda personagens da cena fonte com refs da biblioteca
    const inheritedChars: Character[] = []
    const inheritedRefImgs: RefItem[] = []
    for (const charId of scene.characters) {
      // Tenta achar em CHARACTERS (leads) primeiro
      const lead = CHARACTERS.find(c => c.id === charId)
      if (lead) {
        inheritedChars.push(lead)
        // Injeta refs da library[charId] se houver (prioriza filtrada)
        const entry = filteredLibrary[charId] ?? library[charId]
        if (entry?.images?.length) {
          let ca = 0
          for (const img of entry.images) {
            if (ca >= 3 || inheritedRefImgs.length >= 9) break
            ca++
            inheritedRefImgs.push({ url: img, label: `@image${inheritedRefImgs.length + 1}`, name: entry.name, fromLib: true, charId })
          }
        }
        continue
      }
      // Tenta achar nos customs do Atelier
      const custom = atAssets.find(a => a.id === charId && a.type === 'character' && !a.isOfficial)
      if (custom) {
        inheritedChars.push({
          id: custom.id,
          name: custom.name,
          emoji: custom.emoji ?? '👤',
          color: C.purple,
          desc: custom.description ?? '',
        })
        for (const img of custom.imageUrls) {
          if (inheritedRefImgs.length >= 9) break
          inheritedRefImgs.push({ url: img, label: `@image${inheritedRefImgs.length + 1}`, name: custom.name, fromLib: true, charId: custom.id })
        }
      }
    }
    setSelChars(inheritedChars)
    setRefImgs(inheritedRefImgs)

    // Limpa o prompt e a descrição (nova cena começa do zero narrativamente)
    setPrompts({ pt: '', en: '' })
    setSdDesc('')

    // Toast de feedback imediato
    const labelTitle = scene.title?.trim() ? ` "${scene.title.trim()}"` : ''
    setToast(`🔗 Encadeando a partir da Cena #${scene.sceneNumber}${labelTitle}. Elenco e mood herdados.`)
    window.setTimeout(() => setToast(''), 5000)

    // Foca o textarea do assistente (nova cena) após o re-render
    window.setTimeout(() => {
      sdDescRef.current?.focus()
      sdDescRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
  }

  /**
   * Desfaz o encadeamento ativo — remove a cena fonte da referência,
   * limpa lastResult + chain + chainSource. Mantém elenco/mood/setting
   * já herdados (criador não perde trabalho, só o link é desfeito).
   */
  const unchain = () => {
    if (!chainSource) return
    // Remove o vídeo da cena fonte das refs
    setRefVids(prev => prev.filter(r => r.charId !== `chain_source_${chainSource.id}`).map((r, i) => ({ ...r, label: `@video${i + 1}` })))
    setLastResult('')
    setChain(false)
    setChainSource(null)
    setToast('Encadeamento desfeito. Elenco e mood foram mantidos.')
    window.setTimeout(() => setToast(''), 3000)
  }

  /**
   * Limpa o editor do Estúdio para começar uma nova cena do zero.
   * Preserva o que NÃO é específico da cena (personagens selecionados,
   * modo, duração, ratio, projeto, episódio). Limpa prompts, formulário
   * do assistente, referências do Omni, first/last frames e o resultado.
   * Se já existe trabalho em andamento, pede confirmação antes.
   */
  const resetEditor = (force = false) => {
    const hasWork =
      (prompts.pt.trim().length > 0) ||
      (prompts.en.trim().length > 0) ||
      sdDesc.trim().length > 0 ||
      sdSetting.trim().length > 0 ||
      sdEmotion.trim().length > 0 ||
      refImgs.length > 0 ||
      refVids.length > 0 ||
      refAuds.length > 0 ||
      !!firstUrl || !!lastUrl ||
      sceneNumberInput.trim().length > 0 ||
      sceneTitleInput.trim().length > 0

    const doReset = () => {
      setPrompts({ pt: '', en: '' })
      setSdDesc(''); setSdSetting(''); setSdEmotion('')
      setSdMood(DEFAULT_MOOD_ID)
      setSdStatus('idle'); setSdMsg('')
      setRefImgs([]); setRefVids([]); setRefAuds([])
      setFirstUrl(''); setLastUrl(''); setFirstPreview(''); setLastPreview('')
      setResultUrl(''); setStatus('idle'); setStatusMsg('')
      setChain(false); setChainSource(null)
      setSceneNumberInput(''); setSceneTitleInput('')
      setToast(currentEpisode ? `Pronto para criar nova cena em "${currentEpisode.name?.trim() || '(sem nome)'}"` : 'Pronto para criar nova cena')
      window.setTimeout(() => setToast(''), 3500)
      // Sobe pro topo do Estúdio
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    if (!force && hasWork) {
      askConfirm({
        title: 'Descartar a cena em edição?',
        description: 'Há dados preenchidos no editor. Ao começar uma nova cena, eles serão descartados (a cena que já foi gerada permanece salva).',
        confirmLabel: 'Descartar e começar nova',
        onConfirm: () => doReset()
      })
    } else {
      doReset()
    }
  }

  /* Toast simples para feedback pós-ação */
  const [toast, setToast] = useState('')

  const injectTags = () => {
    const tags = selChars.map(c => library[c.id] ? `@image${refImgs.findIndex(r => r.charId === c.id) + 1}` : `@character:${c.id}`).join(' ')
    setPrompts(p => ({ ...p, [lang]: p[lang] ? `${p[lang]} ${tags}` : tags }))
  }

  /* ── Logout ── */
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  /* ── Generate Video — via /api/generate (sem CORS) ── */
  const generate = async () => {
    if (!prompts[lang].trim()) { setStatus('error'); setStatusMsg('Escreva o prompt.'); return }
    setGenerating(true); setStatus('generating'); setStatusMsg('Enviando para Seedance 2.0...'); setResultUrl('')

    // ── SALVAGUARDA: detecta @ids no prompt que não têm ref associada ──
    // Se algum personagem foi mencionado no prompt (ex: @theos) mas não
    // está no refImgs, tenta adicionar as imagens dele da biblioteca antes
    // de enviar. Garante que o @id seja convertido para @imageN corretamente.
    let workingRefImgs = [...refImgs]
    const mentionRegex = /@(\w+)/g
    const mentionedInPrompt = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = mentionRegex.exec(prompts[lang])) !== null) {
      const id = m[1].toLowerCase()
      // Ignora tags técnicas já resolvidas (@image1, @video1, etc)
      if (/^image\d+$/.test(id) || /^video\d+$/.test(id) || /^audio\d+$/.test(id)) continue
      if (CHARACTERS.find(c => c.id === id)) mentionedInPrompt.add(id)
    }
    // Para cada personagem mencionado, garante que suas imagens estão no refImgs
    const addedChars: Character[] = []
    for (const id of Array.from(mentionedInPrompt)) {
      const alreadyHas = workingRefImgs.some(r => r.charId === id)
      if (alreadyHas) continue
      const entry = filteredLibrary[id]
      if (!entry?.images?.length) continue
      const char = CHARACTERS.find(c => c.id === id)!
      addedChars.push(char)
      // Máximo 3 refs por personagem para otimizar consistência
      let charAdded = 0
      for (const img of entry.images) {
        if (charAdded >= 3 || workingRefImgs.length >= 9) break
        charAdded++
        workingRefImgs.push({ url: img, label: `@image${workingRefImgs.length + 1}`, name: char.name, fromLib: true, charId: id })
      }
    }
    if (addedChars.length > 0) {
      // Sincroniza state para o usuário ver o que foi adicionado
      setRefImgs(workingRefImgs)
      if (mode !== 'omni_reference') setMode('omni_reference')
      const newSelChars = [...selChars]
      addedChars.forEach(c => { if (!newSelChars.find(x => x.id === c.id)) newSelChars.push(c) })
      setSelChars(newSelChars)
    }

    // Substitui @NomePersonagem por @imageN automaticamente (usa workingRefImgs)
    let finalPrompt = prompts[lang]
    workingRefImgs.forEach((r, i) => {
      if (r.name) {
        // Substitui @Nome, @nome (case insensitive) pelo @imageN correto
        const namePattern = new RegExp(`@${r.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
        finalPrompt = finalPrompt.replace(namePattern, `@image${i + 1}`)
        // Também substitui por charId se existir (ex: @tuba, @abraao)
        if (r.charId) {
          const idPattern = new RegExp(`@${r.charId}\\b`, 'gi')
          finalPrompt = finalPrompt.replace(idPattern, `@image${i + 1}`)
        }
      }
    })

    const body: Record<string, unknown> = {
      engineId,
      prompt: finalPrompt,
      duration,
      aspect_ratio: ratio,
      resolution: engine.defaultResolution,
      generate_audio: generateAudio,
      mode,
    }

    if (mode === 'first_last_frames') {
      if (firstUrl) body.first_frame_url = firstUrl
      if (lastUrl) body.last_frame_url = lastUrl
    }
    if (mode === 'omni_reference') {
      if (workingRefImgs.length) body.reference_images = workingRefImgs.map(r => r.url)
      if (refVids.length) body.reference_videos = refVids.map(r => r.url)
      if (refAuds.length) body.reference_audios = refAuds.map(r => r.url)
      // Garante que @VideoN e @AudioN estejam no prompt (Seedance exige menção)
      let p = body.prompt as string
      refVids.forEach((_, i) => {
        const tag = `@Video${i + 1}`
        if (!p.includes(tag) && !p.toLowerCase().includes(tag.toLowerCase())) {
          p = `${p} Referencing ${tag} for motion and scene continuity.`
        }
      })
      refAuds.forEach((_, i) => {
        const tag = `@Audio${i + 1}`
        if (!p.includes(tag) && !p.toLowerCase().includes(tag.toLowerCase())) {
          p = `${p} Use ${tag} for audio reference.`
        }
      })
      body.prompt = p
    }
    // Chain com first_frame_url SOMENTE se NÃO estiver em omni_reference
    if (chain && lastResult && mode !== 'omni_reference') body.first_frame_url = lastResult

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || `Erro ${res.status}`) }
      // Servidor retorna { videoUrl } no modo síncrono OU
      // { jobId, status:'queued', async:true } quando USE_ASYNC_GENERATION está ligada.
      const data = await res.json() as { videoUrl?: string; jobId?: string; async?: boolean }
      console.log('[/api/generate] resposta:', data)

      let url = data.videoUrl ?? ''
      if (!url && data.jobId) {
        setStatusMsg('Processando em background (job ' + data.jobId.slice(0, 8) + ')...')
        const finished = await pollJobUntilDone<{ videoUrl?: string }>(data.jobId, {
          onUpdate: (job: JobPollingView<{ videoUrl?: string }>) => {
            if (job.status === 'running') {
              const pct = typeof job.progress === 'number' ? ` ${job.progress}%` : ''
              setStatusMsg('Gerando vídeo...' + pct)
            }
          },
        })
        url = finished.output?.videoUrl ?? ''
      }

      if (!url) throw new Error('Servidor não retornou videoUrl. Resposta: ' + JSON.stringify(data))
      setResultUrl(url); setLastResult(url); setStatus('success'); setStatusMsg('Vídeo gerado!')
      loadMyBudget() // atualiza barra de budget no header
      loadMyWallet() // atualiza saldo da wallet no header
      const now = Date.now()
      setHistory(p => [{
        id: now,
        prompt: prompts[lang].slice(0, 90) + (prompts[lang].length > 90 ? '…' : ''),
        chars: selChars.map(c => c.name).join(', '),
        mode, ratio, duration, cost, url,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
      }, ...p.slice(0, 19)])

      // Salva cena como asset persistente (sempre — com ou sem episódio)
      const epScenes = currentEpisode
        ? sceneAssets.filter(s => s.episodeId === currentEpisode.id)
        : sceneAssets.filter(s => !s.episodeId)
      // Número: usa o manual se preenchido, senão max + 1 (ou 1 se vazio)
      const manualNumber = parseInt(sceneNumberInput.trim(), 10)
      const sceneNumber = !isNaN(manualNumber) && manualNumber > 0
        ? manualNumber
        : (epScenes.length ? Math.max(...epScenes.map(s => s.sceneNumber)) + 1 : 1)
      const scene: SceneAsset = {
        id: `scene_${now}`,
        episodeId: currentEpisode?.id ?? null,
        projectId: currentProject?.id ?? null,
        sceneNumber,
        title: sceneTitleInput.trim() || undefined,
        prompt: prompts[lang],
        videoUrl: url, lastFrameUrl: url,
        characters: selChars.map(c => c.id), duration, cost,
        createdAt: new Date().toISOString(),
        status: 'draft',
        mood: sdMood,
        setting: sdSetting.trim() || undefined,
        emotion: sdEmotion.trim() || undefined,
      }
      setSceneAssets(p => [...p, scene])
      fetch('/api/scenes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scene) }).catch(() => {})
    } catch (err: unknown) {
      setStatus('error'); setStatusMsg(err instanceof Error ? err.message : 'Erro ao gerar vídeo.')
    } finally {
      setGenerating(false)
    }
  }

  const statusColor = status === 'success' ? C.green : status === 'error' ? C.red : C.gold

  /* ═══════════ ATELIER — ações ═══════════ */

  const atResetForm = () => {
    setAtName('')
    setAtId('')
    setAtIdEdited(false)
    setAtDesc('')
    setAtRefUrl('')
    setAtResults([])
    setAtSelected(new Set())
    setAtTags([])
    setAtStatus('')
  }

  const atRefinePrompt = async () => {
    if (!atDesc.trim()) { setAtStatus('Escreva a descrição antes.'); return }
    setAtRefining(true); setAtStatus('Claude refinando o prompt...')
    try {
      const res = await fetch('/api/image-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: atType, description: atDesc, has_reference: !!atRefUrl, mood: atMood }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || `Erro ${res.status}`) }
      const data = await res.json() as { prompt: string; name_suggestion: string; tags: string[] }
      setAtDesc(data.prompt)
      if (!atName.trim() && data.name_suggestion) {
        setAtName(data.name_suggestion)
      }
      if (data.tags?.length) setAtTags(data.tags)
      setAtStatus('Prompt refinado ✓')
    } catch (err) {
      setAtStatus(err instanceof Error ? err.message : 'Erro ao refinar.')
    } finally {
      setAtRefining(false)
    }
  }

  const atUploadRef = async (file: File) => {
    try {
      const url = await toBlobUrl(file)
      setAtRefUrl(url)
      setAtStatus('Referência anexada ✓')
    } catch (err) {
      setAtStatus(err instanceof Error ? err.message : 'Falha no upload.')
    }
  }

  const atGenerate = async () => {
    if (!atDesc.trim()) { setAtStatus('Escreva a descrição antes.'); return }
    if (!atName.trim()) { setAtStatus('Dê um nome pro asset.'); return }
    setAtGenerating(true); setAtStatus('Gerando variações...'); setAtResults([]); setAtSelected(new Set())
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineId: atEngineId,
          prompt: atDesc,
          num_outputs: atVariations,
          reference_image_url: atRefUrl || undefined,
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || `Erro ${res.status}`) }
      const data = await res.json() as { imageUrls: string[]; errors?: string[] }
      setAtResults(data.imageUrls ?? [])
      setAtStatus(`${data.imageUrls?.length ?? 0}/${atVariations} variações geradas. Selecione quais salvar.`)
      loadMyBudget() // atualiza budget no header
      loadMyWallet() // atualiza saldo da wallet no header

      // Salva todas como drafts imediatamente (caminho seguro — o usuário
      // promove depois as que quiser). Drafts expiram em 30 dias.
      for (const url of data.imageUrls ?? []) {
        fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: atType,
            name: atName,
            description: atDesc,
            imageUrls: [url],
            prompt: atDesc,
            engineId: atEngineId,
            sourceRefUrl: atRefUrl || undefined,
            isDraft: true,
            tags: atTags,
          }),
        }).catch(() => {})
      }
    } catch (err) {
      setAtStatus(err instanceof Error ? err.message : 'Erro ao gerar.')
    } finally {
      setAtGenerating(false)
    }
  }

  const atSaveSelected = async () => {
    if (atSelected.size === 0) { setAtStatus('Selecione ao menos uma variação.'); return }
    const urls = Array.from(atSelected).map(i => atResults[i]).filter(Boolean)
    const id = (atId || slugify(atName)).toLowerCase()
    const savedName = atName
    const savedType = atType
    const firstUrl = urls[0]
    setAtStatus('Salvando na Biblioteca...')
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          type: atType,
          name: atName,
          description: atDesc,
          imageUrls: urls,
          prompt: atDesc,
          engineId: atEngineId,
          sourceRefUrl: atRefUrl || undefined,
          tags: atTags,
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || `Erro ${res.status}`) }
      // Mostra banner de sucesso acima do form. NÃO muda de sub-aba —
      // usuário fica no Criar e decide se quer ir pra Biblioteca ou
      // criar outro asset.
      setAtLastSaved({ id, name: savedName, type: savedType, imageUrl: firstUrl })
      setAtStatus('')
      atResetForm()
      await loadAssets(atType)
      // Toast auto-dismiss em 10s
      window.setTimeout(() => setAtLastSaved(null), 10000)
    } catch (err) {
      setAtStatus(err instanceof Error ? err.message : 'Erro ao salvar.')
    }
  }

  const atDiscardResults = () => {
    setAtResults([])
    setAtSelected(new Set())
    setAtStatus('')
  }

  const atDeleteAsset = async (asset: Asset) => {
    if (asset.isOfficial) return
    const params = new URLSearchParams({ type: asset.type })
    if (asset.isDraft) params.set('draft', '1')
    try {
      await fetch(`/api/assets/${encodeURIComponent(asset.id)}?${params.toString()}`, { method: 'DELETE' })
      await loadAssets(atType)
    } catch {}
  }

  const atPromoteDraft = async (draft: Asset) => {
    const params = new URLSearchParams({ type: draft.type, draft: '1' })
    try {
      await fetch(`/api/assets/${encodeURIComponent(draft.id)}?${params.toString()}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDraft: false, id: slugify(draft.name) }),
      })
      await loadAssets(atType)
    } catch {}
  }

  /* ─────────────────────────── RENDER ─────────────────────────── */
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", fontSize: 14 }}>

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{currentUser?.workspaceName ?? 'Creative Studio'}</div>
          <Pill color={C.textDim}>{engine.name}</Pill>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Pill color={C.green}>{showBrl && brlRate ? `R$${(cp(engine.id, engine.pricePerSecond) * brlRate).toFixed(2)}/s` : `$${cp(engine.id, engine.pricePerSecond).toFixed(2)}/s`}</Pill>
          <Pill color={C.purple}>{Object.keys(library).length} sheets</Pill>
          {/* Budget pill pra creators com cap mensal */}
          {myBudget && myBudget.capUsd !== undefined && (
            <BudgetPill usedUsd={myBudget.usedUsd} capUsd={myBudget.capUsd} percentageUsed={myBudget.percentageUsed ?? 0} />
          )}
          {/* Wallet pill — saldo da org (click to open extrato) */}
          {myWallet && (
            <WalletPill wallet={myWallet} showBrl={showBrl} brlRate={brlRate} onClick={() => setShowExtrato(true)} />
          )}
          {/* BRL toggle */}
          <button
            onClick={toggleBrl}
            title={showBrl ? 'Ocultar conversão BRL' : 'Mostrar valores em BRL'}
            style={{
              background: showBrl ? `${C.green}20` : 'transparent',
              border: `1px solid ${showBrl ? C.green + '60' : C.border}`,
              borderRadius: 14,
              padding: '3px 10px',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
              color: showBrl ? C.green : C.textDim,
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            R$
          </button>

          {/* Link para Super Admin — só para super_admin */}
          {currentUser?.role === 'super_admin' && (
            <a
              href="/admin"
              title="Painel da Plataforma"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: `${C.gold}15`, border: `1px solid ${C.gold}40`,
                borderRadius: 14, padding: '4px 12px', textDecoration: 'none',
                fontSize: 11, fontWeight: 700, color: C.gold,
                transition: 'all 0.15s',
              }}
            >
              Painel
            </a>
          )}

          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: '4px 12px 4px 6px' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: isAdminUser ? C.gold : C.purple, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{currentUser.name}</span>
              {isAdminUser && <span style={{ fontSize: 9, color: C.gold, background: `${C.gold}20`, padding: '1px 6px', borderRadius: 8, border: `1px solid ${C.gold}50`, fontWeight: 700, letterSpacing: '0.3px' }}>ADMIN</span>}
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: C.textDim, fontSize: 13, fontFamily: 'inherit' }}
          >
            Sair
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.surface, padding: '0 24px' }}>
        {([
          ['studio', 'Estúdio'],
          ['cantigas', '🎵 Cantigas'],
          ['senoide', '🎙 Senoide'],
          ['atelier', '🎨 Atelier'],
          ['library', 'Assets'],
          ...(isAdminUser ? [['admin', '👑 Admin']] : []),
        ] as [string, string][]).map(([id, lbl]) => (
          <button key={id} onClick={() => {
            // Proteção de rota: avisa se está no meio de uma cantiga
            if (tab === 'cantigas' && id !== 'cantigas') {
              setCantigaLeaveWarning(id)
              return
            }
            setTab(id)
          }} style={{ background: 'transparent', border: 'none', borderBottom: tab === id ? `2px solid ${id === 'admin' ? C.gold : C.purple}` : '2px solid transparent', color: tab === id ? C.text : C.textDim, padding: '13px 20px', cursor: 'pointer', fontSize: 14, fontWeight: tab === id ? 600 : 400, fontFamily: 'inherit', transition: 'all 0.15s' }}>{lbl}</button>
        ))}
      </div>

      {/* ══════════ ESTÚDIO ══════════ */}
      {tab === 'studio' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', minHeight: 'calc(100vh - 100px)' }}>

          {/* ── Esquerda: Preview grande + Prompt ── */}
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>

            {/* Banner de chain — aparece quando encadeando de outra cena */}
            {chainSource && (
              <div style={{
                background: `linear-gradient(90deg, ${C.purple}18, ${C.blue}12)`,
                border: `1px solid ${C.purple}60`,
                borderRadius: 12,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}>
                <video
                  src={chainSource.videoUrl}
                  muted
                  playsInline
                  preload="metadata"
                  style={{ width: 80, height: 48, borderRadius: 6, objectFit: 'cover', background: '#000', border: `1px solid ${C.purple}40` }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, letterSpacing: '0.5px', marginBottom: 3 }}>
                    🔗 ENCADEANDO DE
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Cena #{chainSource.sceneNumber}
                    {chainSource.title && <span style={{ color: C.textDim, marginLeft: 6 }}>— {chainSource.title}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>{chainSource.duration}s</span>
                    <span>·</span>
                    <span>{chainSource.characters.length} personagens herdados</span>
                    {chainSource.mood && (
                      <>
                        <span>·</span>
                        <span>Mood {getMood(chainSource.mood).shortLabel} {sdMood !== chainSource.mood ? `→ ${getMood(sdMood).shortLabel}` : '(mantido)'}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={unchain}
                  title="Desfazer encadeamento — elenco e mood permanecem"
                  style={{
                    background: 'transparent',
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    padding: '7px 14px',
                    cursor: 'pointer',
                    color: C.textDim,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ✕ Desfazer
                </button>
              </div>
            )}

            {/* Projeto + Episódio seletor */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Projeto */}
              <select
                value={currentProject?.id ?? ''}
                onChange={e => {
                  const val = e.target.value
                  if (val === '__new__') { setShowNewProjectInput(true); return }
                  setCurrentProject(projects.find(p => p.id === val) ?? null)
                }}
                style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 14, fontFamily: 'inherit', flex: 1, outline: 'none' }}
              >
                <option value="">📁 Todos os projetos</option>
                {projects.map(p => <option key={p.id} value={p.id}>📁 {p.name}</option>)}
                <option value="__new__">＋ Novo projeto...</option>
              </select>

              {/* Episódio */}
              <select value={currentEpisode?.id ?? ''} onChange={e => setCurrentEpisode(filteredEpisodes.find(ep => ep.id === e.target.value) ?? null)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 14, fontFamily: 'inherit', flex: 1, outline: 'none' }}>
                <option value="">🎬 Selecione um episódio</option>
                {filteredEpisodes.map(ep => <option key={ep.id} value={ep.id}>{ep.name}</option>)}
              </select>

              <Input
                placeholder="Novo episódio..."
                value={newEpName}
                onChange={e => { setNewEpName(e.target.value); if (newEpError) setNewEpError('') }}
                onKeyDown={e => e.key === 'Enter' && createEpisode()}
                style={{ width: 180, borderColor: newEpError ? C.red : undefined }}
              />
              <button
                onClick={createEpisode}
                title={newEpName.trim() ? 'Criar novo episódio' : 'Digite o nome antes de criar'}
                style={{ background: C.purple, border: `1px solid ${C.purple}`, borderRadius: 8, padding: '8px 16px', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >+ Criar</button>
            </div>

            {/* Feedback de erro inline para criação de episódio */}
            {newEpError && (
              <div style={{ background: `${C.red}10`, border: `1px solid ${C.red}40`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: C.red, display: 'flex', alignItems: 'center', gap: 8 }}>
                ⚠ {newEpError}
              </div>
            )}

            {/* Input inline para novo projeto */}
            {showNewProjectInput && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: `${C.purple}10`, border: `1px solid ${C.purple}40`, borderRadius: 8, padding: '10px 12px' }}>
                <span style={{ fontSize: 13, color: C.purple, fontWeight: 600 }}>Novo projeto:</span>
                <Input autoFocus placeholder="Nome do projeto..." value={newProjectName} onChange={e => setNewProjectName(e.target.value)} onKeyDown={e => {
                  if (e.key === 'Enter') createProject()
                  if (e.key === 'Escape') { setShowNewProjectInput(false); setNewProjectName('') }
                }} style={{ flex: 1 }} />
                <button onClick={createProject} disabled={!newProjectName.trim()} style={{ background: newProjectName.trim() ? C.purple : C.card, border: `1px solid ${newProjectName.trim() ? C.purple : C.border}`, borderRadius: 8, padding: '8px 16px', cursor: newProjectName.trim() ? 'pointer' : 'default', color: newProjectName.trim() ? '#fff' : C.textDim, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Criar</button>
                <button onClick={() => { setShowNewProjectInput(false); setNewProjectName('') }} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: C.textDim, fontSize: 13, fontFamily: 'inherit' }}>Cancelar</button>
              </div>
            )}

            {/* Faixa contextual — cenas do episódio ativo */}
            {currentEpisode && (() => {
              const epScenes = sceneAssets
                .filter(s => s.episodeId === currentEpisode.id)
                .sort((a, b) => a.sceneNumber - b.sceneNumber)
              return (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                      <span>🎬</span>
                      {editingEpName ? (
                        <>
                          <Input
                            autoFocus
                            value={epNameDraft}
                            onChange={e => setEpNameDraft(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                renameEpisode(currentEpisode.id, epNameDraft)
                                setCurrentEpisode({ ...currentEpisode, name: epNameDraft.trim() })
                                setEditingEpName(false)
                              } else if (e.key === 'Escape') {
                                setEditingEpName(false)
                              }
                            }}
                            onBlur={() => {
                              if (epNameDraft.trim()) {
                                renameEpisode(currentEpisode.id, epNameDraft)
                                setCurrentEpisode({ ...currentEpisode, name: epNameDraft.trim() })
                              }
                              setEditingEpName(false)
                            }}
                            style={{ maxWidth: 300, padding: '6px 10px', fontSize: 13 }}
                          />
                        </>
                      ) : (
                        <>
                          <span>{currentEpisode.name?.trim() || '(sem nome)'}</span>
                          <button
                            onClick={() => { setEpNameDraft(currentEpisode.name?.trim() || ''); setEditingEpName(true) }}
                            title="Renomear episódio"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 12, padding: 2, fontFamily: 'inherit' }}
                          >✎</button>
                          <span style={{ color: C.textDim, fontWeight: 400 }}>· {epScenes.length} cena{epScenes.length !== 1 ? 's' : ''}</span>
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {epScenes.length >= 2 && (
                        <button
                          onClick={() => {
                            const playable = epScenes.filter(s => s.status !== 'rejected')
                            if (playable.length >= 2) setSequentialPlayer({ scenes: playable, title: currentEpisode.name?.trim() || '(sem nome)' })
                          }}
                          title="Assistir todas as cenas em sequência"
                          style={{ background: C.purpleGlow, border: `1px solid ${C.purple}50`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: C.purple, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}
                        >▶ Assistir episódio</button>
                      )}
                      <button
                        onClick={() => resetEditor()}
                        title="Limpar o editor e começar uma cena nova do zero"
                        style={{ background: C.purple, border: `1px solid ${C.purple}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', boxShadow: `0 2px 8px ${C.purple}30` }}
                      >+ Nova cena</button>
                    </div>
                  </div>
                  {epScenes.length === 0 ? (
                    <div style={{ color: C.textDim, fontSize: 12, padding: '8px 0' }}>
                      Nenhuma cena neste episódio ainda. Gere a primeira abaixo.
                    </div>
                  ) : (
                    <div
                      style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}
                      onDragOver={e => {
                        if (!draggingSceneId) return
                        e.preventDefault()
                      }}
                      onDrop={e => {
                        if (!draggingSceneId || dragOverIdx == null) return
                        e.preventDefault()
                        reorderScene(draggingSceneId, dragOverIdx)
                        setDraggingSceneId(null)
                        setDragOverIdx(null)
                      }}
                    >
                      {epScenes.map((scene, idx) => (
                        <React.Fragment key={scene.id}>
                          {/* Indicador de drop entre cards */}
                          {draggingSceneId && draggingSceneId !== scene.id && (
                            <div
                              onDragOver={e => { e.preventDefault(); setDragOverIdx(idx) }}
                              style={{
                                width: dragOverIdx === idx ? 10 : 4,
                                alignSelf: 'stretch',
                                background: dragOverIdx === idx ? C.purple : 'transparent',
                                borderRadius: 3,
                                transition: 'width 0.12s, background 0.12s',
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <div
                            draggable
                            onDragStart={e => {
                              setDraggingSceneId(scene.id)
                              e.dataTransfer.effectAllowed = 'move'
                              // Uma imagem fantasma (opcional)
                              if (e.dataTransfer.setDragImage) {
                                const el = e.currentTarget as HTMLElement
                                e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2)
                              }
                            }}
                            onDragEnd={() => { setDraggingSceneId(null); setDragOverIdx(null) }}
                            onDragOver={e => {
                              if (!draggingSceneId || draggingSceneId === scene.id) return
                              e.preventDefault()
                              // Decide antes ou depois do card baseado na metade do mouse
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                              const midX = rect.left + rect.width / 2
                              const dropBefore = e.clientX < midX
                              setDragOverIdx(dropBefore ? idx : idx + 1)
                            }}
                            style={{
                              flexShrink: 0,
                              width: 160,
                              background: C.card,
                              border: `1px solid ${scene.status === 'approved' ? `${C.green}60` : C.border}`,
                              borderRadius: 10,
                              overflow: 'hidden',
                              opacity: draggingSceneId === scene.id ? 0.35 : (scene.status === 'rejected' ? 0.55 : 1),
                              cursor: draggingSceneId ? 'grabbing' : 'grab',
                              transition: 'opacity 0.15s',
                            }}
                          >
                          <div
                            style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000', cursor: draggingSceneId ? 'grabbing' : 'pointer' }}
                            onClick={() => !draggingSceneId && setPlayerModalScene(scene)}
                          >
                            <video
                              src={scene.videoUrl}
                              muted
                              playsInline
                              preload="metadata"
                              style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                              onMouseEnter={e => !draggingSceneId && (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                              onMouseLeave={e => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
                            />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}>
                              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(167,139,250,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff' }}>▶</div>
                            </div>
                            {/* Dot de status */}
                            <div
                              title={scene.status === 'approved' ? 'Aprovada' : scene.status === 'rejected' ? 'Rejeitada' : 'Rascunho'}
                              style={{ position: 'absolute', top: 6, left: 6, width: 8, height: 8, borderRadius: '50%', background: scene.status === 'approved' ? C.green : scene.status === 'rejected' ? C.red : C.gold, boxShadow: '0 0 4px rgba(0,0,0,0.5)' }}
                            />
                            {/* Drag handle */}
                            <div
                              title="Arrastar para reordenar"
                              style={{ position: 'absolute', top: 6, right: 6, color: '#fff', fontSize: 12, background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '1px 5px', lineHeight: 1 }}
                            >⠿</div>
                          </div>
                          <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <span style={{ color: C.purple }}>#{scene.sceneNumber}</span>
                              {scene.title && <span style={{ opacity: 0.85 }}> {scene.title}</span>}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                              <span style={{ fontSize: 10, color: C.textDim }}>{scene.duration}s</span>
                              <button
                                onClick={() => injectSceneAsFirstFrame(scene)}
                                title="Usar como referência para encadear a próxima cena"
                                style={{ background: `${C.gold}15`, border: `1px solid ${C.gold}40`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: C.gold, fontSize: 11, fontFamily: 'inherit' }}
                              >🔗</button>
                            </div>
                          </div>
                          </div>
                        </React.Fragment>
                      ))}
                      {/* Indicador de drop no final */}
                      {draggingSceneId && (
                        <div
                          onDragOver={e => { e.preventDefault(); setDragOverIdx(epScenes.length) }}
                          style={{
                            width: dragOverIdx === epScenes.length ? 10 : 4,
                            alignSelf: 'stretch',
                            background: dragOverIdx === epScenes.length ? C.purple : 'transparent',
                            borderRadius: 3,
                            transition: 'width 0.12s, background 0.12s',
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Video Preview — grande */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
              {resultUrl
                ? <video src={resultUrl} controls autoPlay loop style={{ width: '100%', borderRadius: 8 }} />
                : <div style={{ textAlign: 'center', color: C.textDim, padding: 60 }}><div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div><div style={{ fontSize: 16 }}>O vídeo aparecerá aqui</div></div>
              }
            </div>

            {/* Download + Status */}
            {resultUrl && (
              <button
                onClick={() => downloadVideo(resultUrl, `aaz-${Date.now()}.mp4`)}
                style={{ display: 'block', width: '100%', textAlign: 'center', padding: '12px', background: C.purpleGlow, border: `1px solid ${C.purple}50`, borderRadius: 10, color: C.purple, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >↓ Baixar MP4</button>
            )}

            {status !== 'idle' && (
              <div style={{ textAlign: 'center' }}>
                <Pill color={statusColor}>{status === 'generating' && '⟳ '}{status === 'success' && '✓ '}{status === 'error' && '✕ '}{statusMsg}</Pill>
              </div>
            )}

            {/* Metadados da cena — número e título (opcionais) */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 11, color: C.textDim, fontWeight: 600, letterSpacing: '0.3px' }}>CENA</div>
              <Input
                type="number"
                placeholder="Nº"
                min={1}
                value={sceneNumberInput}
                onChange={e => setSceneNumberInput(e.target.value)}
                style={{ width: 70, textAlign: 'center' }}
                title="Número da cena (opcional — se vazio, numera automaticamente)"
              />
              <Input
                placeholder="Título (opcional) — ex: Encontro no parque"
                value={sceneTitleInput}
                onChange={e => setSceneTitleInput(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
                title="Título curto para identificar a cena depois"
              />
            </div>

            {/* Prompt — abaixo do vídeo */}
            <div>
              {/* Toggle Assistente | Livre */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Label>Prompt</Label>
                <div style={{ display: 'flex', gap: 4, background: C.card, padding: 3, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  <button onClick={() => setPromptMode('assistant')} style={{ padding: '6px 14px', borderRadius: 6, background: promptMode === 'assistant' ? C.purple : 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: promptMode === 'assistant' ? '#fff' : C.textDim, fontFamily: 'inherit' }}>✨ Assistente</button>
                  <button onClick={() => setPromptMode('free')} style={{ padding: '6px 14px', borderRadius: 6, background: promptMode === 'free' ? C.purple : 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: promptMode === 'free' ? '#fff' : C.textDim, fontFamily: 'inherit' }}>✍ Livre</button>
                </div>
              </div>

              {/* MODO ASSISTENTE — formulário guiado */}
              {promptMode === 'assistant' && (
                <div style={{ background: `${C.purple}08`, border: `1px solid ${C.purple}30`, borderRadius: 12, padding: 16, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.purple, marginBottom: 6, letterSpacing: '0.3px' }}>DESCREVA A CENA EM PORTUGUÊS <span style={{ color: C.textDim, fontWeight: 400, textTransform: 'none' }}>— digite @ para mencionar um personagem</span></div>
                    <textarea
                      ref={sdDescRef}
                      placeholder="Ex: @abigail está no parque. Ela encontra @tuba e corre feliz pra abraçá-lo. Os dois brincam juntos."
                      value={sdDesc}
                      onChange={handleSdDescChange}
                      onKeyDown={handleSdDescKeyDown}
                      onBlur={() => window.setTimeout(() => setMention(null), 150)}
                      style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px', color: C.text, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical', outline: 'none', boxSizing: 'border-box', minHeight: 80 }}
                      rows={3}
                    />
                    {/* Dropdown de mention */}
                    {mention && mentionMatches.length > 0 && (
                      <div style={{ position: 'absolute', ...(mention.dir === 'up' ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }), left: 0, right: 0, background: C.card, border: `1px solid ${C.purple}60`, borderRadius: 10, boxShadow: `0 8px 24px rgba(0,0,0,0.4)`, zIndex: 50, maxHeight: 320, overflowY: 'auto' }}>
                        <div style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px', borderBottom: `1px solid ${C.border}` }}>
                          MENCIONAR {mention.query && `· "${mention.query}"`}
                        </div>
                        {mentionMatches.map((item, i) => {
                          const isHighlighted = i === mention.highlightIdx
                          const isCreate = item.kind === 'create'
                          return (
                            <button
                              key={`${item.kind}-${item.id}`}
                              onMouseDown={e => { e.preventDefault(); selectMention(item) }}
                              onMouseEnter={() => setMention(m => m ? { ...m, highlightIdx: i } : m)}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: isHighlighted ? `${item.color}20` : 'transparent', border: 'none', borderTop: isCreate ? `1px solid ${C.border}` : 'none', cursor: 'pointer', color: C.text, fontSize: 13, fontFamily: 'inherit', textAlign: 'left' }}
                            >
                              <span style={{ fontSize: 20 }}>{item.emoji}</span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                                <span style={{ fontWeight: 600, color: isHighlighted ? item.color : C.text }}>{item.name}</span>
                                <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>
                                  {isCreate ? 'Abre Quick-Create' : `@${item.id}`}
                                  {!isCreate && item.isOfficial && <span style={{ marginLeft: 6, color: C.gold }}>⭐ Lead</span>}
                                  {!isCreate && !item.isOfficial && item.type !== 'character' && (
                                    <span style={{ marginLeft: 6, color: item.color }}>
                                      {item.type === 'scenario' ? '🏞 Cenário' : '🧺 Item'}
                                    </span>
                                  )}
                                </span>
                              </div>
                              {!isCreate && (item.hasRefs ? (
                                <span style={{ fontSize: 9, color: C.green, background: `${C.green}15`, padding: '2px 8px', borderRadius: 6, border: `1px solid ${C.green}40`, whiteSpace: 'nowrap' }}>
                                  {item.refUrls.length} refs
                                </span>
                              ) : (
                                <span style={{ fontSize: 9, color: C.textDim, whiteSpace: 'nowrap' }}>sem refs</span>
                              ))}
                            </button>
                          )
                        })}
                        <div style={{ padding: '6px 12px', fontSize: 10, color: C.textDim, borderTop: `1px solid ${C.border}` }}>
                          ↑↓ navegar · Enter selecionar · Esc fechar
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.purple, marginBottom: 6, letterSpacing: '0.3px' }}>LOCALIZAÇÃO (opcional)</div>
                      <Input placeholder="Ex: Parque, Clube da Aliança..." value={sdSetting} onChange={e => setSdSetting(e.target.value)} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.purple, marginBottom: 6, letterSpacing: '0.3px' }}>EMOÇÃO DO PERSONAGEM (opcional)</div>
                      <Input placeholder="Ex: alegria, tensão, reflexão..." value={sdEmotion} onChange={e => setSdEmotion(e.target.value)} />
                    </div>
                  </div>

                  {/* Mood visual da cena — campo separado da emoção. Mood afeta
                      iluminação/paleta/atmosfera (bloco Style & Mood); emoção
                      afeta body physics dos personagens. Podem contrastar. */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: C.purple, marginBottom: 6, letterSpacing: '0.3px' }}>
                      MOOD VISUAL DA CENA <span style={{ color: C.textDim, fontWeight: 400 }}>— iluminação, paleta, atmosfera</span>
                    </div>
                    <select
                      value={sdMood}
                      onChange={e => setSdMood(e.target.value as MoodId)}
                      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 13, fontFamily: 'inherit', width: '100%', outline: 'none' }}
                    >
                      {MOODS.map(m => (
                        <option key={m.id} value={m.id}>{m.label} — {m.narrative}</option>
                      ))}
                    </select>
                  </div>

                  {/* Contexto herdado do Estúdio */}
                  <div style={{ fontSize: 11, color: C.textDim, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <span style={{ opacity: 0.7 }}>Usando do Estúdio:</span>
                    <Pill color={C.blue} style={{ fontSize: 10, padding: '2px 8px' }}>⏱ {duration}s</Pill>
                    {selChars.length > 0 ? selChars.map(c => (
                      <Pill key={c.id} color={c.color} style={{ fontSize: 10, padding: '2px 8px' }}>{c.emoji} {c.name}</Pill>
                    )) : <span style={{ opacity: 0.6 }}>nenhum personagem selecionado</span>}
                  </div>

                  <button
                    onClick={runSceneDirector}
                    disabled={!sdDesc.trim() || sdStatus === 'generating' || !canUseSceneDirector}
                    title={!canUseSceneDirector ? 'Sem permissao para usar o Scene Director' : undefined}
                    style={{ background: !sdDesc.trim() || sdStatus === 'generating' || !canUseSceneDirector ? C.card : C.purple, border: `1px solid ${!sdDesc.trim() || sdStatus === 'generating' || !canUseSceneDirector ? C.border : C.purple}`, borderRadius: 10, padding: '12px', cursor: !sdDesc.trim() || sdStatus === 'generating' || !canUseSceneDirector ? 'not-allowed' : 'pointer', color: !sdDesc.trim() || sdStatus === 'generating' || !canUseSceneDirector ? C.textDim : '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', opacity: !canUseSceneDirector ? 0.5 : 1 }}
                  >
                    {!canUseSceneDirector ? 'Sem permissao' : sdStatus === 'generating' ? '⟳ Claude escrevendo...' : 'Gerar Prompt com IA'}
                  </button>

                  {sdStatus !== 'idle' && sdStatus !== 'generating' && (
                    <div style={{ textAlign: 'center' }}>
                      <Pill color={sdStatus === 'success' ? C.green : C.red}>{sdMsg}</Pill>
                    </div>
                  )}
                </div>
              )}

              {/* Scene strip — visualização dos assets usados na cena */}
              <SceneAssetsStrip
                refImgs={refImgs}
                promptText={prompts[lang]}
                atAssets={atAssets}
                mood={sdMood}
                onMoodChange={setSdMood}
                onRemove={(charId) => {
                  setRefImgs(p => p.filter(r => r.charId !== charId).map((r, i) => ({ ...r, label: `@image${i + 1}` })))
                  setSelChars(p => p.filter(c => c.id !== charId))
                }}
                onOpenAtelier={() => setTab('atelier')}
              />

              {/* Prompt textarea — sempre visível (editável tanto no modo Livre quanto após gerar no Assistente) */}
              <div style={{ display: 'flex', gap: 4, background: C.card, padding: 4, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 8 }}>
                {[['pt', 'PT-BR'], ['en', 'EN']].map(([l, lbl]) => (
                  <button key={l} onClick={() => setLang(l as 'pt' | 'en')} style={{ flex: 1, padding: '8px', borderRadius: 8, background: lang === l ? C.surface : 'transparent', border: lang === l ? `1px solid ${C.border}` : '1px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: lang === l ? C.text : C.textDim, transition: 'all 0.15s', fontFamily: 'inherit' }}>{lbl}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>
                {promptMode === 'assistant' ? 'Prompt gerado (editável antes de gerar o vídeo) — @ para mencionar personagens' : 'Escreva o prompt diretamente — digite @ para mencionar um personagem'}
              </div>
              <div style={{ position: 'relative' }}>
                <textarea
                  ref={promptTextareaRef}
                  placeholder={lang === 'pt' ? 'Descreva a cena...' : 'Describe the scene...'}
                  value={prompts[lang]}
                  onChange={handlePromptChange}
                  onKeyDown={handlePromptKeyDown}
                  onBlur={() => window.setTimeout(() => setPromptMention(null), 150)}
                  style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px', color: C.text, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box', minHeight: 100 }}
                  rows={4}
                />
                {/* Dropdown de mention (prompt) */}
                {promptMention && promptMentionMatches.length > 0 && (
                  <div style={{ position: 'absolute', ...(promptMention.dir === 'up' ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }), left: 0, right: 0, background: C.card, border: `1px solid ${C.purple}60`, borderRadius: 10, boxShadow: `0 8px 24px rgba(0,0,0,0.4)`, zIndex: 50, maxHeight: 320, overflowY: 'auto' }}>
                    <div style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px', borderBottom: `1px solid ${C.border}` }}>
                      MENCIONAR {promptMention.query && `· "${promptMention.query}"`}
                    </div>
                    {promptMentionMatches.map((item, i) => {
                      const isHighlighted = i === promptMention.highlightIdx
                      const isCreate = item.kind === 'create'
                      return (
                        <button
                          key={`${item.kind}-${item.id}`}
                          onMouseDown={e => { e.preventDefault(); selectPromptMention(item) }}
                          onMouseEnter={() => setPromptMention(m => m ? { ...m, highlightIdx: i } : m)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: isHighlighted ? `${item.color}20` : 'transparent', border: 'none', borderTop: isCreate ? `1px solid ${C.border}` : 'none', cursor: 'pointer', color: C.text, fontSize: 13, fontFamily: 'inherit', textAlign: 'left' }}
                        >
                          <span style={{ fontSize: 20 }}>{item.emoji}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                            <span style={{ fontWeight: 600, color: isHighlighted ? item.color : C.text }}>{item.name}</span>
                            <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>
                              {isCreate ? 'Abre Quick-Create' : `@${item.id}`}
                              {!isCreate && item.isOfficial && <span style={{ marginLeft: 6, color: C.gold }}>⭐ Lead</span>}
                              {!isCreate && !item.isOfficial && item.type !== 'character' && (
                                <span style={{ marginLeft: 6, color: item.color }}>
                                  {item.type === 'scenario' ? '🏞 Cenário' : '🧺 Item'}
                                </span>
                              )}
                            </span>
                          </div>
                          {!isCreate && (item.hasRefs ? (
                            <span style={{ fontSize: 9, color: C.green, background: `${C.green}15`, padding: '2px 8px', borderRadius: 6, border: `1px solid ${C.green}40`, whiteSpace: 'nowrap' }}>
                              {item.refUrls.length} refs
                            </span>
                          ) : (
                            <span style={{ fontSize: 9, color: C.textDim, whiteSpace: 'nowrap' }}>sem refs</span>
                          ))}
                        </button>
                      )
                    })}
                    <div style={{ padding: '6px 12px', fontSize: 10, color: C.textDim, borderTop: `1px solid ${C.border}` }}>
                      ↑↓ navegar · Enter selecionar · Esc fechar
                    </div>
                  </div>
                )}
              </div>
              {/* Tags @ clicáveis — insere @Nome no prompt, convertido para @imageN ao enviar */}
              {refImgs.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {refImgs.map((r, i) => {
                    const tag = r.charId ? `@${r.charId}` : `@image${i + 1}`
                    return (
                      <button key={i} onClick={() => setPrompts(p => ({ ...p, [lang]: p[lang] + ` ${tag}` }))} style={{ background: `${r.fromLib ? C.purple : C.blue}15`, border: `1px solid ${r.fromLib ? C.purple : C.blue}40`, borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: r.fromLib ? C.purple : C.blue, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: 'monospace' }}>{tag}</span>
                        <span style={{ fontSize: 11, opacity: 0.6 }}>= @image{i + 1}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Engine warnings (quando a engine escolhida não suporta algo ativo) */}
            {engineWarnings.length > 0 && (
              <div style={{ background: `${C.gold}12`, border: `1px solid ${C.gold}40`, borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {engineWarnings.map((w, i) => (
                  <div key={i} style={{ fontSize: 12, color: C.gold, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ lineHeight: 1 }}>⚠</span>
                    <span style={{ lineHeight: 1.4 }}>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Engine selector + Generate button (lado a lado) */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <div style={{ flex: '0 0 42%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 10, color: C.textDim, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Motor de vídeo</div>
                <select
                  value={engineId}
                  onChange={e => setEngineId(e.target.value)}
                  disabled={generating}
                  style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 10px', color: C.text, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', outline: 'none', cursor: generating ? 'not-allowed' : 'pointer', flex: 1 }}
                >
                  {VIDEO_ENGINES.map(eng => (
                    <option key={eng.id} value={eng.id}>
                      {eng.name} · {showBrl && brlRate ? `R$${(cp(eng.id, eng.pricePerSecond) * brlRate).toFixed(2)}/s` : `$${cp(eng.id, eng.pricePerSecond).toFixed(2)}/s`}
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={generate} disabled={generating || !canGenerateVideo} title={!canGenerateVideo ? 'Sem permissao para gerar videos' : undefined} style={{ flex: 1, background: (generating || !canGenerateVideo) ? C.card : C.purple, border: `1px solid ${(generating || !canGenerateVideo) ? C.border : C.purple}`, borderRadius: 12, padding: '12px 16px', cursor: (generating || !canGenerateVideo) ? 'not-allowed' : 'pointer', color: (generating || !canGenerateVideo) ? C.textDim : '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.2s', alignSelf: 'flex-end', opacity: !canGenerateVideo ? 0.5 : 1 }}>
                {!canGenerateVideo ? 'Sem permissao' : generating ? '⟳ Gerando...' : 'Gerar Cena'}
              </button>
            </div>

            {/* Descrição da engine selecionada */}
            <div style={{ fontSize: 11, color: C.textDim, marginTop: -8, paddingLeft: 2 }}>
              {engine.description}
            </div>
          </div>

          {/* ── Direita: Settings ── */}
          <div style={{ padding: '20px', borderLeft: `1px solid ${C.border}`, background: C.surface, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Personagens */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Label>⭐ Leads</Label>
                {selChars.length > 0 && <button onClick={injectTags} style={{ background: C.purpleGlow, border: `1px solid ${C.purple}50`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: C.purple, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>Injetar tags</button>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                {CHARACTERS.map(char => {
                  const sel = selChars.find(c => c.id === char.id)
                  const hasSheet = !!library[char.id]
                  return (
                    <button key={char.id} onClick={() => toggleChar(char)} style={{ background: sel ? `${char.color}18` : C.card, border: `1px solid ${sel ? char.color : C.border}`, borderRadius: 10, padding: '10px 4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative', transition: 'all 0.15s' }}>
                      {hasSheet && <div style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, background: C.green, borderRadius: '50%' }} />}
                      <span style={{ fontSize: 22 }}>{char.emoji}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: sel ? char.color : C.textDim }}>{char.name}</span>
                    </button>
                  )
                })}
              </div>

              {/* Custom characters criados no Atelier */}
              {atAssets.filter(a => a.type === 'character' && !a.isOfficial).length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, letterSpacing: '0.5px', marginTop: 12, marginBottom: 6 }}>CRIADOS</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                    {atAssets.filter(a => a.type === 'character' && !a.isOfficial).slice(0, 8).map(a => {
                      const sel = selChars.find(c => c.id === a.id)
                      return (
                        <button
                          key={a.id}
                          onClick={() => {
                            // Adiciona ao sidebar + injeta refs
                            if (!sel) {
                              setSelChars(p => [...p, { id: a.id, name: a.name, emoji: a.emoji ?? '👤', color: C.purple, desc: a.description }])
                              if (a.imageUrls.length > 0) {
                                if (mode !== 'omni_reference') setMode('omni_reference')
                                setRefImgs(p => {
                                  const next = [...p]
                                  for (const url of a.imageUrls) {
                                    if (next.length >= 9) break
                                    if (next.some(r => r.url === url)) continue
                                    next.push({ url, label: `@image${next.length + 1}`, name: a.name, fromLib: true, charId: a.id })
                                  }
                                  return next
                                })
                              }
                            } else {
                              setSelChars(p => p.filter(x => x.id !== a.id))
                              setRefImgs(p => p.filter(r => r.charId !== a.id).map((r, i) => ({ ...r, label: `@image${i + 1}` })))
                            }
                          }}
                          style={{ background: sel ? `${C.purple}18` : C.card, border: `1px solid ${sel ? C.purple : C.border}`, borderRadius: 10, padding: '10px 4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                        >
                          <span style={{ fontSize: 22 }}>{a.emoji ?? '👤'}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: sel ? C.purple : C.textDim, textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '100%', whiteSpace: 'nowrap' }}>{a.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Quick-create buttons */}
              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setQuickCreate({ type: 'character', initialName: '' })}
                  style={{ flex: 1, background: C.purpleGlow, border: `1px dashed ${C.purple}60`, borderRadius: 8, padding: '8px 6px', cursor: 'pointer', color: C.purple, fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}
                >
                  ＋ Personagem
                </button>
                <button
                  onClick={() => setQuickCreate({ type: 'scenario', initialName: '' })}
                  style={{ flex: 1, background: `${C.blue}15`, border: `1px dashed ${C.blue}60`, borderRadius: 8, padding: '8px 6px', cursor: 'pointer', color: C.blue, fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}
                >
                  ＋ Cenário
                </button>
                <button
                  onClick={() => setQuickCreate({ type: 'item', initialName: '' })}
                  style={{ flex: 1, background: `${C.gold}15`, border: `1px dashed ${C.gold}60`, borderRadius: 8, padding: '8px 6px', cursor: 'pointer', color: C.gold, fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}
                >
                  ＋ Item
                </button>
              </div>

              {selChars.filter(c => library[c.id]).length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {selChars.filter(c => library[c.id]).map(c => (
                    <button key={c.id} onClick={() => { setMode('omni_reference'); addFromLibrary(c.id) }} style={{ background: C.purpleGlow, border: `1px solid ${C.purple}50`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: C.purple, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>+ Sheet {c.name}</button>
                  ))}
                </div>
              )}
            </div>

            <Divider />

            {/* Modo */}
            <div>
              <Label>Modo</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {MODES.map(m => (
                  <button key={m.id} onClick={() => setMode(m.id)} style={{ background: mode === m.id ? `${C.purple}18` : C.card, border: `1px solid ${mode === m.id ? C.purple : C.border}`, borderRadius: 10, padding: '10px 14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{m.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: mode === m.id ? C.text : C.textDim }}>{m.label}</div>
                      <div style={{ fontSize: 11, color: C.textDim }}>{m.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* OMNI REFERENCE */}
            {mode === 'omni_reference' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Label>Imagens ({refImgs.length}/9)</Label>
                    <button disabled={refImgs.length >= 9} onClick={() => setAddRefModal('image')} style={{ background: C.blueGlow, border: `1px solid ${C.blue}50`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: C.blue, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', opacity: refImgs.length >= 9 ? 0.4 : 1 }}>+ Adicionar</button>
                    <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { Array.from(e.target.files || []).forEach(async f => { if (refImgs.length < 9) { const url = await toDataUrl(f); setRefImgs(p => [...p, { url, label: `@image${p.length + 1}`, name: f.name }]) } }) }} />
                  </div>
                  {refImgs.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {refImgs.map((r, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <img src={r.url} alt={r.label} style={{ width: 70, height: 70, borderRadius: 8, objectFit: 'cover', border: `1px solid ${r.fromLib ? C.purple : C.border}` }} />
                          <div style={{ position: 'absolute', top: -5, left: -5, background: r.fromLib ? C.purple : C.blue, color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 700, padding: '2px 5px', fontFamily: 'monospace' }}>{r.label}</div>
                          <button onClick={() => setRefImgs(p => p.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -5, right: -5, background: C.red, color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div onClick={() => setAddRefModal('image')} style={{ border: `1px dashed ${C.border}`, borderRadius: 10, padding: '16px', textAlign: 'center', color: C.textDim, fontSize: 13, cursor: 'pointer' }}>Personagem, cenário ou estilo</div>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Label>Vídeos ({refVids.length}/3)</Label>
                    <button disabled={refVids.length >= 3} onClick={() => setAddRefModal('video')} style={{ background: C.blueGlow, border: `1px solid ${C.blue}50`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: C.blue, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', opacity: refVids.length >= 3 ? 0.4 : 1 }}>+ Adicionar</button>
                    <input ref={vidRef} type="file" accept="video/mp4,video/mov" multiple style={{ display: 'none' }} onChange={e => addRef(e, 'video', refVids, setRefVids, 3)} />
                  </div>
                  {refVids.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {refVids.map((r, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px' }}>
                          <span style={{ fontSize: 12, fontFamily: 'monospace', color: C.blue }}>{r.label}</span>
                          <span style={{ fontSize: 12, color: C.textDim, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                          <button onClick={() => setRefVids(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div onClick={() => setAddRefModal('video')} style={{ border: `1px dashed ${C.border}`, borderRadius: 10, padding: '14px', textAlign: 'center', color: C.textDim, fontSize: 13, cursor: 'pointer' }}>Movimento de câmera ou estilo</div>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Label>Áudios ({refAuds.length}/3)</Label>
                    <button disabled={refAuds.length >= 3} onClick={() => setAddRefModal('audio')} style={{ background: C.blueGlow, border: `1px solid ${C.blue}50`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: C.blue, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', opacity: refAuds.length >= 3 ? 0.4 : 1 }}>+ Adicionar</button>
                    <input ref={audRef} type="file" accept="audio/mp3,audio/wav" multiple style={{ display: 'none' }} onChange={e => addRef(e, 'audio', refAuds, setRefAuds, 3)} />
                  </div>
                  {refAuds.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {refAuds.map((r, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px' }}>
                          <span style={{ fontSize: 12, fontFamily: 'monospace', color: C.purple }}>{r.label}</span>
                          <span style={{ fontSize: 12, color: C.textDim, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                          <button onClick={() => setRefAuds(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div onClick={() => setAddRefModal('audio')} style={{ border: `1px dashed ${C.border}`, borderRadius: 10, padding: '14px', textAlign: 'center', color: C.textDim, fontSize: 13, cursor: 'pointer' }}>Voz, música ou ambiente</div>
                  )}
                </div>
              </div>
            )}

            {/* First/Last */}
            {mode === 'first_last_frames' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Label>Frames de Início e Fim</Label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, color: C.textDim, marginBottom: 6 }}>Primeiro</div>
                    {firstPreview ? (
                      <div style={{ position: 'relative' }}>
                        <img src={firstPreview} alt="First frame" style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}`, aspectRatio: '16/9', objectFit: 'cover' }} />
                        <button onClick={() => { setFirstUrl(''); setFirstPreview('') }} style={{ position: 'absolute', top: -6, right: -6, background: C.red, color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      </div>
                    ) : (
                      <div onClick={() => firstFrameRef.current?.click()} style={{ border: `1px dashed ${C.border}`, borderRadius: 10, padding: '20px', textAlign: 'center', color: C.textDim, fontSize: 12, cursor: 'pointer', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Upload</div>
                    )}
                    <input ref={firstFrameRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFrame(f, setFirstUrl, setFirstPreview) }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: C.textDim, marginBottom: 6 }}>Último</div>
                    {lastPreview ? (
                      <div style={{ position: 'relative' }}>
                        <img src={lastPreview} alt="Last frame" style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.border}`, aspectRatio: '16/9', objectFit: 'cover' }} />
                        <button onClick={() => { setLastUrl(''); setLastPreview('') }} style={{ position: 'absolute', top: -6, right: -6, background: C.red, color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      </div>
                    ) : (
                      <div onClick={() => lastFrameRef.current?.click()} style={{ border: `1px dashed ${C.border}`, borderRadius: 10, padding: '20px', textAlign: 'center', color: C.textDim, fontSize: 12, cursor: 'pointer', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Upload</div>
                    )}
                    <input ref={lastFrameRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFrame(f, setLastUrl, setLastPreview) }} />
                  </div>
                </div>
              </div>
            )}

            <Divider />

            {/* Settings compactos */}
            <div>
              <Label>Ratio</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {RATIOS.map(r => (
                  <button key={r} onClick={() => setRatio(r)} style={{ background: ratio === r ? `${C.purple}20` : C.card, border: `1px solid ${ratio === r ? C.purple : C.border}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: ratio === r ? C.text : C.textDim, fontFamily: 'monospace', transition: 'all 0.15s' }}>{r}</button>
                ))}
              </div>
            </div>

            <div>
              <Label>Duração</Label>
              <div style={{ display: 'flex', gap: 6 }}>
                {DURATIONS.map(d => (
                  <button key={d} onClick={() => setDuration(d)} style={{ background: duration === d ? `${C.purple}20` : C.card, border: `1px solid ${duration === d ? C.purple : C.border}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: duration === d ? C.text : C.textDim, fontFamily: 'monospace', transition: 'all 0.15s' }}>{d}s</button>
                ))}
              </div>
            </div>

            {/* Áudio */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="generate-audio" checked={generateAudio} onChange={e => setGenerateAudio(e.target.checked)} style={{ accentColor: C.purple, width: 16, height: 16 }} />
              <label htmlFor="generate-audio" style={{ cursor: 'pointer', fontSize: 13, flex: 1 }}>
                Gerar com áudio
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Sons ambiente e diálogo são gerados junto</div>
              </label>
            </div>

            {/* Custo (preço estimado baseado na engine selecionada) */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, color: C.textDim }}>{duration}s · {showBrl && brlRate ? `R$${(cp(engine.id, engine.pricePerSecond) * brlRate).toFixed(2)}/s` : `$${cp(engine.id, engine.pricePerSecond).toFixed(2)}/s`}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.green, fontFamily: 'monospace' }}>{showBrl && brlRate ? `R$${(parseFloat(cost) * brlRate).toFixed(2)}` : `$${cost}`}</div>
              </div>
              <div style={{ fontSize: 10, color: C.textDim, fontStyle: 'italic', letterSpacing: '0.3px' }}>
                {engine.name} · será descontado do saldo
              </div>
            </div>

            {lastResult && (
              <div style={{ background: C.card, border: `1px solid ${C.green}40`, borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="chain" checked={chain} onChange={e => setChain(e.target.checked)} style={{ accentColor: C.purple, width: 16, height: 16 }} />
                <label htmlFor="chain" style={{ cursor: 'pointer', fontSize: 13 }}>Encadear do último frame</label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ CANTIGAS — Produção de cantigas infantis ══════════ */}
      {tab === 'cantigas' && (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <CantigasWizard
            currentUser={currentUser}
            clientPrices={clientPrices}
            showBrl={showBrl}
            brlRate={brlRate}
            onGoToStudio={(prompt, _audioUrl, dur, chars) => {
              setTab('studio')
              setMode('omni_reference')
              setDuration(dur > 0 ? dur : 5)
              setGenerateAudio(true) // áudio ambiente gerado pelo Seedance
              setRefAuds([]) // NÃO envia cantiga como ref (limite 15s do Seedance)

              // Seleciona personagens e injeta refs do Character Sheet
              const matched = chars.map(id => CHARACTERS.find(c => c.id === id)).filter(Boolean) as Character[]
              if (matched.length) {
                setSelChars(matched)
                // Injeta character sheets como @Image refs
                const newRefs: RefItem[] = []
                for (const char of matched) {
                  const entry = library[char.id]
                  if (!entry?.images?.length) continue
                  let added = 0
                  for (const img of entry.images) {
                    if (added >= 3 || newRefs.length >= 9) break
                    added++
                    newRefs.push({ url: img, label: `@image${newRefs.length + 1}`, name: char.name, fromLib: true, charId: char.id })
                  }
                }
                if (newRefs.length) setRefImgs(newRefs)
              }

              // Monta o prompt com @mentions dos personagens
              let finalPrompt = prompt
              chars.forEach((charId, i) => {
                const char = CHARACTERS.find(c => c.id === charId)
                if (char) {
                  // Adiciona @imageN ao final do prompt para referenciar o character sheet
                  finalPrompt += ` @image${i + 1} is ${char.name}.`
                }
              })
              setPrompts(prev => ({ ...prev, en: finalPrompt }))
              setLang('en')
            }}
          />
        </div>
      )}

      {/* ══════════ SENOIDE — Produção de áudio ══════════ */}
      {tab === 'senoide' && (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <SenoidePanel currentUser={currentUser} clientPrices={clientPrices} showBrl={showBrl} brlRate={brlRate} library={library} atAssets={filteredAtAssets} episodes={episodes} sceneAssets={filteredSceneAssets} />
        </div>
      )}

      {/* ══════════ ATELIER — Geração de assets de imagem ══════════ */}
      {tab === 'atelier' && (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Header da aba — apresentação do workshop */}
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 28 }}>✨</span>
              <span>Criar novo asset</span>
            </div>
            <div style={{ fontSize: 13, color: C.textDim, marginTop: 4 }}>
              Gere personagens, cenários e itens únicos para suas cenas. Os assets criados ficam disponíveis em <button onClick={() => setTab('library')} style={{ background: 'transparent', border: 'none', color: C.purple, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: 0 }}>Assets</button>.
            </div>
          </div>

          {/* Character Sheet Generator */}
          <div style={{ background: `${C.purple}10`, border: `1px solid ${C.purple}30`, borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Character Sheet Generator</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>Crie um sheet completo (6 vistas: frontal, perfil, costas...) para manter consistência nas cenas.</div>
            </div>
            <button onClick={() => setShowSheetWizard(true)} style={{ background: C.purple, border: 'none', borderRadius: 8, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>+ Criar Sheet</button>
          </div>

          {/* Seletor de tipo — ação primária, bem destacado */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.8px', marginBottom: 10 }}>
              O QUE VOCÊ QUER CRIAR?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {([
                ['character', '👤', 'Personagem', 'Pessoas, animais, criaturas'],
                ['scenario', '🏞', 'Cenário', 'Lugares, ambientes, fundos'],
                ['item', '🧺', 'Item / Prop', 'Objetos, utensílios, adereços'],
              ] as [AssetType, string, string, string][]).map(([t, icon, lbl, sub]) => (
                <button
                  key={t}
                  onClick={() => { setAtType(t); atResetForm() }}
                  style={{
                    background: atType === t ? C.purpleGlow : C.card,
                    border: `2px solid ${atType === t ? C.purple : C.border}`,
                    borderRadius: 14,
                    padding: '18px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s',
                    boxShadow: atType === t ? `0 4px 20px ${C.purple}25` : 'none',
                  }}
                >
                  <span style={{ fontSize: 36 }}>{icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: atType === t ? C.purple : C.text }}>{lbl}</span>
                  <span style={{ fontSize: 11, color: C.textDim, textAlign: 'center' }}>{sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CRIAR sempre renderiza direto */}
          <>
            {/* Banner de sucesso — aparece depois de salvar um asset */}
            {atLastSaved && (
              <div style={{
                background: `${C.green}15`,
                border: `1px solid ${C.green}60`,
                borderRadius: 12,
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                marginBottom: 4,
              }}>
                <img
                  src={atLastSaved.imageUrl}
                  alt={atLastSaved.name}
                  style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.green}60` }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.green, marginBottom: 2 }}>
                    ✓ Salvo na Biblioteca!
                  </div>
                  <div style={{ fontSize: 13, color: C.text }}>
                    <strong>{atLastSaved.name}</strong>
                    <span style={{ marginLeft: 8, fontFamily: 'monospace', color: C.textDim, fontSize: 12 }}>@{atLastSaved.id}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                    Já disponível via <span style={{ fontFamily: 'monospace' }}>@{atLastSaved.id}</span> nas cenas do Estúdio
                  </div>
                </div>
                <button
                  onClick={() => { setTab('library'); setLibTab(atLastSaved.type === 'scenario' ? 'scenarios' : atLastSaved.type === 'item' ? 'props' : 'chars') }}
                  style={{ background: C.green, border: `1px solid ${C.green}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                >
                  Ver na Biblioteca →
                </button>
                <button
                  onClick={() => setAtLastSaved(null)}
                  title="Dispensar"
                  style={{ background: 'transparent', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 18, padding: 4, fontFamily: 'inherit' }}
                >
                  ×
                </button>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

              {/* Esquerda — formulário */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={atName}
                    onChange={e => setAtName(e.target.value)}
                    placeholder={atType === 'character' ? 'Faraó' : atType === 'scenario' ? 'Nilo ao entardecer' : 'Cajado de madeira'}
                  />
                </div>

                <div>
                  <Label>@id <span style={{ fontSize: 10, color: C.textDim, fontWeight: 400 }}>(auto-gerado, editável)</span></Label>
                  <Input
                    value={atId}
                    onChange={e => { setAtId(slugify(e.target.value)); setAtIdEdited(true) }}
                    style={{ fontFamily: 'monospace' }}
                    placeholder="farao"
                  />
                </div>

                <div>
                  <Label>Descrição</Label>
                  <textarea
                    value={atDesc}
                    onChange={e => setAtDesc(e.target.value)}
                    placeholder={
                      atType === 'character'
                        ? 'Faraó do Egito antigo, adulto, coroa dupla (vermelha e branca), olhar severo, manto real dourado...'
                        : atType === 'scenario'
                        ? 'Interior do palácio egípcio ao fim da tarde, colunas de pedra, luz dourada entrando pelas janelas altas...'
                        : 'Cajado de madeira, gasto e polido pelo uso, com correia de couro perto do cabo...'
                    }
                    style={{
                      width: '100%',
                      minHeight: 140,
                      background: C.card,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      padding: '10px 14px',
                      color: C.text,
                      fontSize: 14,
                      fontFamily: 'inherit',
                      outline: 'none',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={atRefinePrompt}
                      disabled={atRefining || !atDesc.trim() || !canUseImageDirector}
                      title={!canUseImageDirector ? 'Sem permissao para usar o Image Director' : undefined}
                      style={{
                        background: C.purpleGlow,
                        border: `1px solid ${C.purple}50`,
                        borderRadius: 8,
                        padding: '8px 14px',
                        cursor: (atRefining || !canUseImageDirector) ? 'not-allowed' : 'pointer',
                        color: C.purple,
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: 'inherit',
                        opacity: (atRefining || !atDesc.trim() || !canUseImageDirector) ? 0.5 : 1,
                      }}
                    >
                      {!canUseImageDirector ? 'Sem permissao' : atRefining ? '⟳ Refinando...' : 'Refinar com IA'}
                    </button>
                    <div style={{ flex: 1, textAlign: 'right', fontSize: 11, color: C.textDim, alignSelf: 'center' }}>
                      {atDesc.length} caracteres
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Referência opcional</Label>
                  {atRefUrl ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img src={atRefUrl} alt="ref" style={{ width: 120, height: 120, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.border}` }} />
                      <button onClick={() => setAtRefUrl('')} style={{ position: 'absolute', top: -6, right: -6, background: C.red, color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 12 }}>×</button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => atRefInput.current?.click()}
                        style={{ background: C.card, border: `1px dashed ${C.border}`, borderRadius: 10, padding: '14px 20px', cursor: 'pointer', color: C.textDim, fontSize: 13, fontFamily: 'inherit' }}
                      >
                        📎 Anexar imagem (pose, estilo, ponto de partida)
                      </button>
                      <input
                        ref={atRefInput}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) atUploadRef(f) }}
                      />
                    </>
                  )}
                </div>

                <div>
                  <Label>Mood / Tom visual</Label>
                  <select
                    value={atMood}
                    onChange={e => setAtMood(e.target.value as MoodId)}
                    style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 14, fontFamily: 'inherit', width: '100%', outline: 'none' }}
                  >
                    {MOODS.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 4, fontStyle: 'italic' }}>
                    {getMood(atMood).narrative}
                  </div>
                </div>

                <div>
                  <Label>Motor de imagem</Label>
                  <select
                    value={atEngineId}
                    onChange={e => setAtEngineId(e.target.value)}
                    style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 14, fontFamily: 'inherit', width: '100%', outline: 'none' }}
                  >
                    {IMAGE_ENGINES.map(eng => (
                      <option key={eng.id} value={eng.id}>
                        {eng.name} · {showBrl && brlRate ? `R$${(cp(eng.id, eng.pricePerImage) * brlRate).toFixed(2)}/img` : `$${cp(eng.id, eng.pricePerImage).toFixed(3)}/img`}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{atEngine.description}</div>
                </div>

                <div>
                  <Label>Variações</Label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 4, 6, 8].map(n => (
                      <button
                        key={n}
                        onClick={() => setAtVariations(n)}
                        style={{
                          flex: 1,
                          background: atVariations === n ? `${C.purple}20` : C.card,
                          border: `1px solid ${atVariations === n ? C.purple : C.border}`,
                          borderRadius: 8,
                          padding: '10px',
                          cursor: 'pointer',
                          color: atVariations === n ? C.text : C.textDim,
                          fontSize: 13,
                          fontWeight: 600,
                          fontFamily: 'monospace',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 13, color: C.textDim }}>{atVariations} × {showBrl && brlRate ? `R$${(cp(atEngine.id, atEngine.pricePerImage) * brlRate).toFixed(2)}` : `$${cp(atEngine.id, atEngine.pricePerImage).toFixed(3)}`}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: C.green, fontFamily: 'monospace' }}>{showBrl && brlRate ? `R$${(parseFloat(atTotalCost) * brlRate).toFixed(2)}` : `$${atTotalCost}`}</div>
                  </div>
                  <div style={{ fontSize: 10, color: C.textDim, fontStyle: 'italic', marginTop: 4 }}>{atEngine.name} · será descontado do saldo</div>
                </div>

                <button
                  onClick={atGenerate}
                  disabled={atGenerating || !atDesc.trim() || !atName.trim() || !canGenerateImage}
                  title={!canGenerateImage ? 'Sem permissao para gerar imagens' : undefined}
                  style={{
                    background: (atGenerating || !canGenerateImage) ? C.card : C.purple,
                    border: `1px solid ${(atGenerating || !canGenerateImage) ? C.border : C.purple}`,
                    borderRadius: 12,
                    padding: '14px',
                    cursor: (atGenerating || !atDesc.trim() || !atName.trim() || !canGenerateImage) ? 'not-allowed' : 'pointer',
                    color: (atGenerating || !canGenerateImage) ? C.textDim : '#fff',
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    opacity: !canGenerateImage ? 0.5 : 1,
                  }}
                >
                  {!canGenerateImage ? 'Sem permissao' : atGenerating ? '⟳ Gerando...' : `Gerar ${atVariations} variações`}
                </button>

                {atStatus && (
                  <div style={{ fontSize: 12, color: C.textDim, textAlign: 'center' }}>{atStatus}</div>
                )}
              </div>

              {/* Direita — resultados */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Label>Resultados {atResults.length > 0 && `(${atResults.length})`}</Label>
                  {atResults.length > 0 && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={atSaveSelected}
                        disabled={atSelected.size === 0}
                        style={{ background: C.green, border: `1px solid ${C.green}`, borderRadius: 8, padding: '6px 12px', cursor: atSelected.size === 0 ? 'not-allowed' : 'pointer', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', opacity: atSelected.size === 0 ? 0.5 : 1 }}
                      >
                        Salvar {atSelected.size} na Biblioteca
                      </button>
                      <button
                        onClick={atDiscardResults}
                        style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: C.textDim, fontSize: 12, fontFamily: 'inherit' }}
                      >
                        Descartar
                      </button>
                    </div>
                  )}
                </div>

                {atResults.length === 0 ? (
                  <div style={{ flex: 1, minHeight: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `1px dashed ${C.border}`, borderRadius: 10, color: C.textDim, fontSize: 13, textAlign: 'center', padding: 20 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>{defaultEmoji(atType)}</div>
                    <div>Preencha a descrição e clique "Gerar"</div>
                    <div style={{ fontSize: 11, marginTop: 6, maxWidth: 260 }}>As {atVariations} variações aparecem aqui. Você escolhe quais ficam na Biblioteca — o resto vai pra Rascunhos por 30 dias.</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    {atResults.map((url, i) => {
                      const isSel = atSelected.has(i)
                      return (
                        <div
                          key={i}
                          onClick={() => {
                            setAtSelected(prev => {
                              const next = new Set(prev)
                              if (next.has(i)) next.delete(i); else next.add(i)
                              return next
                            })
                          }}
                          style={{
                            position: 'relative',
                            cursor: 'pointer',
                            borderRadius: 10,
                            overflow: 'hidden',
                            border: `3px solid ${isSel ? C.green : 'transparent'}`,
                            transition: 'border-color 0.15s',
                            aspectRatio: '1/1',
                            background: '#000',
                          }}
                        >
                          <img src={url} alt={`var ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                            #{i + 1}
                          </div>
                          {isSel && (
                            <div style={{ position: 'absolute', top: 6, right: 6, background: C.green, color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
                              ✓
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {atResults.length > 0 && atSelected.size === 0 && (
                  <div style={{ fontSize: 11, color: C.textDim, textAlign: 'center', fontStyle: 'italic' }}>
                    Clique nas variações pra selecionar. Não selecionadas ficam em Rascunhos (Assets) por 30 dias.
                  </div>
                )}
              </div>
            </div>
            </>
        </div>
      )}

      {/* ══════════ ASSETS — Personagens, Cenários, Cenas ══════════ */}
      {/* ══════════ ADMIN PANEL — só role=admin ══════════ */}
      {tab === 'admin' && isAdminUser && (
        <AdminPanel
          currentUser={currentUser}
          onOpenDelivery={(ep) => setDeliveryModal(ep)}
          showBrl={showBrl}
          brlRate={brlRate}
        />
      )}

      {tab === 'library' && (
        <div style={{ padding: '26px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: 4, background: C.card, padding: 4, borderRadius: 10, border: `1px solid ${C.border}` }}>
            {([
              ['chars', `Personagens (${CHARACTERS.length + atAssets.filter(a => a.type === 'character' && !a.isOfficial).length})`],
              ['scenarios', `Cenários (${atAssets.filter(a => a.type === 'scenario' && !a.isOfficial).length + scenarios.length})`],
              ['props', `Props (${atAssets.filter(a => a.type === 'item' && !a.isOfficial).length})`],
              ['scenes', `Cenas (${sceneAssets.length})`],
              ['drafts', `🗂 Rascunhos (${atDrafts.length})`],
            ] as [typeof libTab, string][]).map(([id, lbl]) => (
              <button key={id} onClick={() => setLibTab(id)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: libTab === id ? C.surface : 'transparent', border: libTab === id ? `1px solid ${C.border}` : '1px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: libTab === id ? C.text : C.textDim, fontFamily: 'inherit' }}>{lbl}</button>
            ))}
          </div>

          {/* Filtro de propriedade */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: C.textDim }}>Exibindo:</span>
            <select
              value={assetOwnerFilter}
              onChange={e => setAssetOwnerFilter(e.target.value as typeof assetOwnerFilter)}
              style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 10px', color: C.text, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}
            >
              <option value="mine">Meus assets</option>
              <option value="team">Assets da equipe</option>
              <option value="all">Todos os assets</option>
            </select>
          </div>

          {/* ═══ PERSONAGENS ═══ */}
          {libTab === 'chars' && (<>

            {/* Grid de personagens salvos */}
            {Object.keys(library).length === 0
              ? <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '40px', textAlign: 'center', color: C.textDim, fontSize: 14 }}>
                  Nenhum personagem salvo ainda. Vá ao <button onClick={() => setTab('atelier')} style={{ background: 'transparent', border: 'none', color: C.purple, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, padding: 0 }}>Atelier</button> e crie um Character Sheet.
                </div>
              : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
                  {Object.values(library).map(entry => {
                    const char = CHARACTERS.find(c => c.id === entry.charId)
                    return (
                      <div key={entry.charId} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', gap: 4, padding: 8, overflowX: 'auto' }}>
                          {entry.images.map((img, i) => (
                            <img key={i} src={img} alt={`${entry.name} ref ${i + 1}`} style={{ width: 90, height: 90, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: `1px solid ${C.border}` }} />
                          ))}
                        </div>
                        <div style={{ padding: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <span style={{ fontSize: 20 }}>{entry.emoji}</span>
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: char?.color || C.text }}>{entry.name}</div>
                              <div style={{ fontSize: 12, color: C.textDim }}>{entry.images.length} referências · {entry.createdAt}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => { setTab('studio'); addFromLibrary(entry.charId) }} style={{ flex: 1, background: C.purpleGlow, border: `1px solid ${C.purple}50`, borderRadius: 8, padding: '8px', cursor: 'pointer', color: C.purple, fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Usar no Estúdio</button>
                            <button
                              onClick={() => askConfirm({
                                title: `Remover ${entry.name}?`,
                                description: `Todas as ${entry.images.length} imagens de referência deste personagem serão removidas da biblioteca.`,
                                thumbnailUrl: undefined,
                                confirmLabel: 'Remover',
                                onConfirm: async () => {
                                  const next = { ...library }; delete next[entry.charId]; setLibrary(next); deleteFromKV(entry.charId)
                                }
                              })}
                              style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: C.red, fontSize: 14, fontFamily: 'inherit' }}
                            >×</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }

            {/* ── Criados por você (personagens custom do Atelier) ── */}
            {atAssets.filter(a => a.type === 'character' && !a.isOfficial).length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.purple }}>Criados por você</div>
                  <Pill color={C.purple}>{atAssets.filter(a => a.type === 'character' && !a.isOfficial).length}</Pill>
                  <button
                    onClick={() => setTab('atelier')}
                    style={{ marginLeft: 'auto', background: C.purpleGlow, border: `1px solid ${C.purple}50`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: C.purple, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}
                  >
                    ✨ Criar novo no Atelier
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
                  {atAssets.filter(a => a.type === 'character' && !a.isOfficial).map(a => (
                    <AtelierAssetCard key={a.id} asset={a} onDelete={atDeleteAsset} />
                  ))}
                </div>
              </div>
            )}

            {atAssets.filter(a => a.type === 'character' && !a.isOfficial).length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: C.textDim, fontSize: 12, border: `1px dashed ${C.border}`, borderRadius: 10 }}>
                Nenhum personagem criado por você ainda. <button onClick={() => setTab('atelier')} style={{ background: 'transparent', border: 'none', color: C.purple, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, padding: 0 }}>Ir ao Atelier</button> pra criar o primeiro.
              </div>
            )}
          </>)}

          {/* ═══ CENÁRIOS ═══ */}
          {libTab === 'scenarios' && (<>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16, alignItems: 'end' }}>
              <div>
                <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>Nome do cenário</div>
                <Input placeholder="Ex: Clube da Aliança..." value={scenarioName} onChange={e => setScenarioName(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>Imagem</div>
                {scenarioPhoto ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={scenarioPhoto.url} alt={scenarioPhoto.name} style={{ width: 80, height: 50, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.border}` }} />
                    <button onClick={() => setScenarioPhoto(null)} style={{ position: 'absolute', top: -4, right: -4, background: C.red, color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                ) : (
                  <div onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = (e) => addScenarioPhoto(e as unknown as React.ChangeEvent<HTMLInputElement>); i.click() }} style={{ border: `1px dashed ${C.border}`, borderRadius: 10, padding: '14px', textAlign: 'center', color: C.textDim, fontSize: 13, cursor: 'pointer' }}>Upload</div>
                )}
              </div>
              <button onClick={saveScenario} disabled={!scenarioName.trim() || !scenarioPhoto} style={{ background: scenarioName.trim() && scenarioPhoto ? C.blue : C.card, border: `1px solid ${scenarioName.trim() && scenarioPhoto ? C.blue : C.border}`, borderRadius: 10, padding: '10px 20px', cursor: scenarioName.trim() && scenarioPhoto ? 'pointer' : 'default', color: scenarioName.trim() && scenarioPhoto ? '#fff' : C.textDim, fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}>+ Salvar</button>
            </div>

            {scenarios.length === 0
              ? <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '40px', textAlign: 'center', color: C.textDim, fontSize: 14 }}>Nenhum cenário salvo.</div>
              : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
                  {scenarios.map(s => (
                    <div key={s.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                      <img src={s.imageUrl} alt={s.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                      <div style={{ padding: '14px' }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.blue, marginBottom: 4 }}>{s.name}</div>
                        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 10 }}>{s.createdAt}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => { setTab('studio'); injectScenario(s) }} style={{ flex: 1, background: C.blueGlow, border: `1px solid ${C.blue}50`, borderRadius: 8, padding: '8px', cursor: 'pointer', color: C.blue, fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Usar no Estúdio</button>
                          <button
                            onClick={() => askConfirm({
                              title: `Remover cenário "${s.name}"?`,
                              description: 'Este cenário será removido da biblioteca. Cenas que já o referenciavam não serão afetadas.',
                              confirmLabel: 'Remover',
                              onConfirm: () => deleteScenario(s.id)
                            })}
                            style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: C.red, fontSize: 14, fontFamily: 'inherit' }}
                          >×</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }

            {/* Cenários criados no Atelier (asset type=scenario) */}
            {atAssets.filter(a => a.type === 'scenario').length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.purple }}>Criados por você</div>
                  <Pill color={C.purple}>{atAssets.filter(a => a.type === 'scenario').length}</Pill>
                  <button
                    onClick={() => setTab('atelier')}
                    style={{ marginLeft: 'auto', background: C.purpleGlow, border: `1px solid ${C.purple}50`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: C.purple, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}
                  >
                    ✨ Criar novo no Atelier
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
                  {atAssets.filter(a => a.type === 'scenario').map(a => (
                    <AtelierAssetCard key={a.id} asset={a} onDelete={atDeleteAsset} />
                  ))}
                </div>
              </div>
            )}
          </>)}

          {/* ═══ PROPS / ITENS — só assets do Atelier, type=item ═══ */}
          {libTab === 'props' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>🧺 Props</div>
                <Pill color={C.gold}>{atAssets.filter(a => a.type === 'item').length}</Pill>
                <button
                  onClick={() => setTab('atelier')}
                  style={{ marginLeft: 'auto', background: C.purpleGlow, border: `1px solid ${C.purple}50`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: C.purple, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}
                >
                  ✨ Criar novo no Atelier
                </button>
              </div>
              <div style={{ fontSize: 12, color: C.textDim }}>
                Objetos, utensílios e adereços. Cada prop pode ser @mencionado nas cenas do Estúdio.
              </div>
              {atAssets.filter(a => a.type === 'item').length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: C.textDim, fontSize: 13, border: `1px dashed ${C.border}`, borderRadius: 10 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🧺</div>
                  Nenhum prop criado ainda. <button onClick={() => setTab('atelier')} style={{ background: 'transparent', border: 'none', color: C.purple, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: 0 }}>Ir ao Atelier</button> pra criar o primeiro.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 14 }}>
                  {atAssets.filter(a => a.type === 'item').map(a => (
                    <AtelierAssetCard key={a.id} asset={a} onDelete={atDeleteAsset} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ RASCUNHOS — variações não promovidas ═══ */}
          {libTab === 'drafts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.gold }}>🗂 Rascunhos</div>
                <Pill color={C.gold}>{atDrafts.length}</Pill>
                <div style={{ marginLeft: 'auto', fontSize: 11, color: C.textDim, fontStyle: 'italic' }}>
                  Expiram automaticamente após 30 dias
                </div>
              </div>
              <div style={{ fontSize: 12, color: C.textDim }}>
                Variações geradas no Atelier que você não escolheu ficam aqui. Você pode promover uma ("↑" a move pra Biblioteca) ou deletar.
              </div>
              {atDrafts.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: C.textDim, fontSize: 13, border: `1px dashed ${C.border}`, borderRadius: 10 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🗂</div>
                  Nenhum rascunho no momento.
                </div>
              ) : (
                <>
                  {(['character', 'scenario', 'item'] as AssetType[]).map(t => {
                    const group = atDrafts.filter(d => d.type === t)
                    if (group.length === 0) return null
                    const label = t === 'character' ? '👤 Personagens' : t === 'scenario' ? '🏞 Cenários' : '🧺 Props'
                    return (
                      <div key={t}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 10, letterSpacing: '0.3px' }}>{label} ({group.length})</div>
                        <AtelierDraftsView
                          type={t}
                          drafts={group}
                          onPromote={atPromoteDraft}
                          onDelete={atDeleteAsset}
                        />
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}

          {/* ═══ CENAS — Ideia 2 + 5 ═══ */}
          {libTab === 'scenes' && (
            <HistoryTab
              scenes={filteredSceneAssets}
              projects={projects}
              episodes={episodes}
              currentUser={currentUser}
              onOpenDelivery={(ep) => setDeliveryModal(ep)}
              onPlay={(s) => setPlayerModalScene(s)}
              onDownload={downloadVideo}
              onDelete={(id) => {
                const scene = sceneAssets.find(s => s.id === id)
                if (!scene) return
                askConfirm({
                  title: 'Deletar esta cena?',
                  description: scene.prompt.slice(0, 120),
                  thumbnailUrl: scene.videoUrl,
                  confirmLabel: 'Deletar cena',
                  onConfirm: async () => {
                    setSceneAssets(prev => prev.filter(s => s.id !== id))
                    await fetch(`/api/scenes/${encodeURIComponent(id)}`, { method: 'DELETE' })
                  }
                })
              }}
              onMoveScene={(s) => setMoveSceneModal(s)}
              onMoveEpisode={(e) => setMoveEpisodeModal(e)}
              onDeleteEpisode={(ep) => askConfirm({
                title: `Deletar "${ep.name?.trim() || '(sem nome)'}"?`,
                description: 'O episódio e TODAS as cenas dentro dele serão removidos permanentemente.',
                confirmLabel: 'Deletar episódio',
                onConfirm: () => deleteEpisode(ep.id)
              })}
              onPlayEpisodeSequential={(ep) => {
                // Não toca cenas rejeitadas
                const epScenes = sceneAssets
                  .filter(s => s.episodeId === ep.id && s.status !== 'rejected')
                  .sort((a, b) => a.sceneNumber - b.sceneNumber)
                if (epScenes.length >= 2) {
                  setSequentialPlayer({ scenes: epScenes, title: ep.name?.trim() || '(sem nome)' })
                }
              }}
              onPlayProjectSequential={(proj) => {
                const projEpisodeIds = new Set(episodes.filter(e => e.projectId === proj.id).map(e => e.id))
                // Não toca cenas rejeitadas
                const projScenes = sceneAssets
                  .filter(s => s.episodeId && projEpisodeIds.has(s.episodeId) && s.status !== 'rejected')
                  .sort((a, b) => {
                    const epA = episodes.find(e => e.id === a.episodeId)
                    const epB = episodes.find(e => e.id === b.episodeId)
                    const cmpEp = (epA?.createdAt || '').localeCompare(epB?.createdAt || '')
                    if (cmpEp !== 0) return cmpEp
                    return a.sceneNumber - b.sceneNumber
                  })
                if (projScenes.length >= 2) {
                  setSequentialPlayer({ scenes: projScenes, title: `Projeto: ${proj.name}` })
                }
              }}
              onSetSceneStatus={updateSceneStatus}
              onRenameEpisode={renameEpisode}
            />
          )}
        </div>
      )}

      {/* Modal do player */}
      {playerModalScene && (
        <div
          onClick={() => setPlayerModalScene(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ position: 'relative', maxWidth: '92vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <button
              onClick={() => setPlayerModalScene(null)}
              aria-label="Fechar"
              style={{ position: 'absolute', top: -14, right: -14, width: 36, height: 36, borderRadius: '50%', background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 18, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
            >×</button>
            <video
              src={playerModalScene.videoUrl}
              controls
              autoPlay
              style={{ maxWidth: '92vw', maxHeight: '80vh', borderRadius: 10, background: '#000' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 4px' }}>
              <div style={{ color: C.text, fontSize: 14, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {playerModalScene.prompt}
              </div>
              <button
                onClick={() => downloadVideo(playerModalScene.videoUrl, `aaz-${playerModalScene.id}.mp4`)}
                style={{ background: C.blueGlow, border: `1px solid ${C.blue}40`, borderRadius: 8, padding: '8px 16px', cursor: 'pointer', color: C.blue, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
              >↓ Baixar</button>
            </div>
            <div style={{ fontSize: 11, color: C.textDim, textAlign: 'center' }}>Pressione ESC ou clique fora para fechar</div>
          </div>
        </div>
      )}

      {/* Modal: Mover cena */}
      {moveSceneModal && (
        <MoveSceneModal
          scene={moveSceneModal}
          projects={projects}
          episodes={episodes}
          onClose={() => setMoveSceneModal(null)}
          onConfirm={async (newEpId, newProjId) => {
            await moveScene(moveSceneModal.id, newEpId, newProjId)
            setMoveSceneModal(null)
          }}
        />
      )}

      {/* Modal: Mover episódio */}
      {moveEpisodeModal && (
        <MoveEpisodeModal
          episode={moveEpisodeModal}
          projects={projects}
          onClose={() => setMoveEpisodeModal(null)}
          onConfirm={async (newProjId) => {
            await moveEpisode(moveEpisodeModal.id, newProjId)
            setMoveEpisodeModal(null)
          }}
        />
      )}

      {/* Modal: Adicionar referência ao Omni */}
      {addRefModal && (
        <AddRefModal
          type={addRefModal}
          library={library}
          scenarios={scenarios}
          onClose={() => setAddRefModal(null)}
          onPickLibraryImage={(url, name, charId) => {
            addImageRefFromUrl(url, name, charId)
            setAddRefModal(null)
          }}
          onPickFile={async (file) => {
            if (addRefModal === 'image') await addImageRefFromFile(file)
            else if (addRefModal === 'video') await addVideoRefFromFile(file)
            else if (addRefModal === 'audio') await addAudioRefFromFile(file)
            setAddRefModal(null)
          }}
        />
      )}

      {/* Episode delivery — upload MP4 final + revisão */}
      {deliveryModal && (
        <EpisodeDeliveryModal
          episode={deliveryModal}
          currentUser={currentUser}
          onClose={() => setDeliveryModal(null)}
          onUpdated={(updated) => {
            setEpisodes(prev => prev.map(e => e.id === updated.id ? updated : e))
            setDeliveryModal(updated)
          }}
        />
      )}

      {/* Wallet Extrato Modal */}
      {showExtrato && (
        <WalletExtratoModal
          showBrl={showBrl}
          brlRate={brlRate}
          onClose={() => setShowExtrato(false)}
        />
      )}

      {/* Modal: Sair da cantiga */}
      {cantigaLeaveWarning && (
        <div onClick={() => setCantigaLeaveWarning(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.bg, border: `1px solid ${C.gold}40`, borderRadius: 14, width: '100%', maxWidth: 420, padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>Sair da criação da cantiga?</div>
            <div style={{ fontSize: 13, color: C.textDim, marginBottom: 16, lineHeight: 1.5 }}>
              Sua cantiga está salva automaticamente. Você pode retomar a qualquer momento em <strong>Cantigas → Minhas Cantigas</strong>.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setCantigaLeaveWarning(null)} style={{ flex: 1, background: C.gold, border: 'none', borderRadius: 8, padding: '10px', color: '#000', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Continuar criando</button>
              <button onClick={() => { setTab(cantigaLeaveWarning); setCantigaLeaveWarning(null) }} style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px', color: C.textDim, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Sair e salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Character Sheet Wizard */}
      {showSheetWizard && (
        <CharacterSheetWizard
          clientPrices={clientPrices}
          showBrl={showBrl}
          brlRate={brlRate}
          onClose={() => setShowSheetWizard(false)}
          onSaved={() => { loadLibrary(); loadAssets() }}
        />
      )}

      {/* Quick-Create — criar asset de imagem sem sair do Estúdio */}
      {quickCreate && (
        <QuickCreateAssetModal
          type={quickCreate.type}
          initialName={quickCreate.initialName}
          onClose={() => setQuickCreate(null)}
          uploadBlob={toBlobUrl}
          onDone={(asset) => {
            // Refresh wallet/budget after generation
            loadMyBudget(); loadMyWallet()
            // Injeta na cena atual
            if (mode !== 'omni_reference') setMode('omni_reference')
            setRefImgs(p => {
              const next = [...p]
              for (const url of asset.imageUrls) {
                if (next.length >= 9) break
                if (next.some(r => r.url === url)) continue
                next.push({ url, label: `@image${next.length + 1}`, name: asset.name, fromLib: true, charId: asset.id })
              }
              return next
            })
            // Se character, adiciona ao sidebar
            if (asset.type === 'character' && !selChars.find(c => c.id === asset.id)) {
              setSelChars(p => [...p, {
                id: asset.id, name: asset.name, emoji: asset.emoji ?? '👤',
                color: C.purple, desc: asset.description
              }])
            }
            // Recarrega assets (pra @mention ver o novo)
            loadAssets()
            setQuickCreate(null)
            setToast(`✓ ${asset.name} adicionado à cena`)
            window.setTimeout(() => setToast(''), 3000)
          }}
        />
      )}

      {/* Modal: Player sequencial */}
      {sequentialPlayer && (
        <SequentialPlayer
          scenes={sequentialPlayer.scenes}
          title={sequentialPlayer.title}
          onClose={() => setSequentialPlayer(null)}
        />
      )}

      {/* Toast — feedback de ações */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: C.card, border: `1px solid ${C.purple}`, borderRadius: 10, padding: '12px 22px', color: C.text, fontSize: 13, fontWeight: 600, boxShadow: `0 6px 24px ${C.purple}40`, zIndex: 1100, fontFamily: 'inherit' }}>
          ✓ {toast}
        </div>
      )}

      {/* Modal: Confirmação de exclusão (dupla verificação) */}
      {confirmModal && (
        <div
          onClick={() => setConfirmModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: C.surface, border: `1px solid ${C.red}40`, borderRadius: 14, padding: 24, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>{confirmModal.title}</h2>
            {confirmModal.thumbnailUrl && (
              <video
                src={confirmModal.thumbnailUrl}
                muted
                playsInline
                preload="metadata"
                style={{ width: '100%', borderRadius: 10, border: `1px solid ${C.border}` }}
              />
            )}
            {confirmModal.description && (
              <div style={{ fontSize: 13, color: C.textDim, lineHeight: 1.5 }}>{confirmModal.description}</div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: `${C.red}10`, border: `1px solid ${C.red}30`, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: C.red }}>
              ⚠️ Esta ação não pode ser desfeita
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: C.textDim, fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
              >Cancelar</button>
              <button
                onClick={async () => {
                  const fn = confirmModal.onConfirm
                  setConfirmModal(null)
                  await fn()
                }}
                style={{ background: C.red, border: `1px solid ${C.red}`, borderRadius: 10, padding: '10px 20px', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}
              >{confirmModal.confirmLabel || 'Deletar'}</button>
            </div>
            <div style={{ fontSize: 11, color: C.textDim, textAlign: 'center' }}>Pressione ESC ou clique fora para cancelar</div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   AddRefModal — Modal para adicionar referência ao Omni Reference
   Duas seções: Da Biblioteca | Do Computador
═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   SequentialPlayer — Modal que toca cenas em sequência
   Usa onEnded do <video> para avançar automaticamente à próxima cena.
═══════════════════════════════════════════════════════════════ */

function SequentialPlayer({ scenes, title, onClose }: { scenes: SceneAsset[]; title: string; onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  // Dois slots A/B para alternância: um mostra o atual, o outro pré-carrega e pré-inicia o próximo
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A')
  const videoRefA = useRef<HTMLVideoElement>(null)
  const videoRefB = useRef<HTMLVideoElement>(null)
  // Controla se o slot inativo já foi "primed" (iniciou o play silencioso)
  const primedRef = useRef<'A' | 'B' | null>(null)

  const current = scenes[index]
  const next = scenes[index + 1]
  const totalDuration = scenes.reduce((s, sc) => s + sc.duration, 0)

  // URLs alocadas em slots: quando activeSlot === 'A', A mostra current e B pré-carrega next
  const srcA = activeSlot === 'A' ? current?.videoUrl : next?.videoUrl
  const srcB = activeSlot === 'B' ? current?.videoUrl : next?.videoUrl

  const getActiveVideo = () => activeSlot === 'A' ? videoRefA.current : videoRefB.current
  const getInactiveVideo = () => activeSlot === 'A' ? videoRefB.current : videoRefA.current
  const getInactiveSlot = (): 'A' | 'B' => activeSlot === 'A' ? 'B' : 'A'

  const goNext = useCallback(() => {
    if (index >= scenes.length - 1) return
    // Alterna o slot ativo (crossfade via CSS opacity) e avança o índice
    setActiveSlot(s => s === 'A' ? 'B' : 'A')
    setIndex(i => i + 1)
    primedRef.current = null
  }, [index, scenes.length])

  const goPrev = useCallback(() => {
    if (index === 0) return
    setActiveSlot(s => s === 'A' ? 'B' : 'A')
    setIndex(i => i - 1)
    primedRef.current = null
  }, [index])

  const togglePause = useCallback(() => {
    const v = getActiveVideo()
    if (!v) return
    if (v.paused) { v.play().catch(() => {}); setPaused(false) }
    else { v.pause(); setPaused(true) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlot])

  /**
   * Auto-play do vídeo ativo quando index/slot mudam.
   * Reset para 0 e play imediato. O fade acontece junto.
   */
  useEffect(() => {
    const v = getActiveVideo()
    if (v) {
      v.currentTime = 0
      v.muted = false
      v.play().catch(() => {})
      setPaused(false)
    }
    // O vídeo inativo também deve estar pronto (carregado) com currentTime 0
    const inactive = getInactiveVideo()
    if (inactive) {
      inactive.currentTime = 0
      inactive.muted = true
      inactive.pause()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, activeSlot])

  /**
   * PRE-START: quando o vídeo ativo está nos últimos 0.3s, já inicia
   * silenciosamente a reprodução do próximo slot (invisível). Assim,
   * quando o crossfade acontece, o vídeo novo JÁ está tocando nos
   * primeiros frames — elimina o "frame congelado" que quebra a continuidade.
   */
  const handleTimeUpdate = () => {
    const v = getActiveVideo()
    if (!v || !v.duration) return
    const remaining = v.duration - v.currentTime
    if (remaining < 0.35 && !primedRef.current && index < scenes.length - 1) {
      const inactive = getInactiveVideo()
      if (inactive) {
        inactive.currentTime = 0
        inactive.muted = true
        inactive.play().catch(() => {})
        primedRef.current = getInactiveSlot()
      }
    }
  }

  // Navegação por teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === ' ') { e.preventDefault(); togglePause() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev, togglePause])

  if (!current) return null

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 1002, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}
    >
      {/* Header */}
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 20, left: 24, right: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>
          ▶ {title}
          <span style={{ color: C.textDim, marginLeft: 10, fontWeight: 400 }}>
            Cena {index + 1} de {scenes.length}
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar"
          style={{ width: 36, height: 36, borderRadius: '50%', background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 18, cursor: 'pointer', fontFamily: 'inherit' }}
        >×</button>
      </div>

      {/* Vídeo principal com dois slots A/B para crossfade e preload */}
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '90vw', height: '75vh', maxWidth: 1600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video
          ref={videoRefA}
          src={srcA || undefined}
          playsInline
          controls={activeSlot === 'A'}
          preload="auto"
          onEnded={activeSlot === 'A' ? goNext : undefined}
          onTimeUpdate={activeSlot === 'A' ? handleTimeUpdate : undefined}
          style={{
            position: 'absolute',
            maxWidth: '100%',
            maxHeight: '100%',
            borderRadius: 10,
            background: '#000',
            opacity: activeSlot === 'A' ? 1 : 0,
            pointerEvents: activeSlot === 'A' ? 'auto' : 'none',
            transition: 'opacity 400ms ease-in-out',
          }}
        />
        <video
          ref={videoRefB}
          src={srcB || undefined}
          playsInline
          controls={activeSlot === 'B'}
          preload="auto"
          onEnded={activeSlot === 'B' ? goNext : undefined}
          onTimeUpdate={activeSlot === 'B' ? handleTimeUpdate : undefined}
          style={{
            position: 'absolute',
            maxWidth: '100%',
            maxHeight: '100%',
            borderRadius: 10,
            background: '#000',
            opacity: activeSlot === 'B' ? 1 : 0,
            pointerEvents: activeSlot === 'B' ? 'auto' : 'none',
            transition: 'opacity 400ms ease-in-out',
          }}
        />
      </div>

      {/* Barra de progresso das cenas */}
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 4, maxWidth: '90vw', width: 600 }}>
        {scenes.map((s, i) => (
          <div
            key={s.id}
            onClick={() => { setActiveSlot(slot => slot === 'A' ? 'B' : 'A'); setIndex(i); primedRef.current = null }}
            title={`Cena ${i + 1}`}
            style={{
              flex: s.duration,
              height: 4,
              background: i <= index ? C.purple : C.border,
              borderRadius: 2,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          />
        ))}
      </div>

      {/* Controles */}
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={goPrev}
          disabled={index === 0}
          title="Cena anterior (←)"
          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 16px', cursor: index === 0 ? 'not-allowed' : 'pointer', color: index === 0 ? C.textDim : C.text, fontSize: 14, fontFamily: 'inherit', opacity: index === 0 ? 0.4 : 1 }}
        >⏮ Anterior</button>
        <button
          onClick={togglePause}
          title="Pausar/Tocar (Espaço)"
          style={{ background: C.purple, border: `1px solid ${C.purple}`, borderRadius: 10, padding: '10px 20px', cursor: 'pointer', color: '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}
        >{paused ? '▶ Tocar' : '⏸ Pausar'}</button>
        <button
          onClick={goNext}
          disabled={index === scenes.length - 1}
          title="Próxima cena (→)"
          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 16px', cursor: index === scenes.length - 1 ? 'not-allowed' : 'pointer', color: index === scenes.length - 1 ? C.textDim : C.text, fontSize: 14, fontFamily: 'inherit', opacity: index === scenes.length - 1 ? 0.4 : 1 }}
        >Próxima ⏭</button>
      </div>

      <div style={{ fontSize: 11, color: C.textDim, textAlign: 'center' }}>
        Duração total: {totalDuration}s · ESC ou clique fora para sair
      </div>
    </div>
  )
}

function AddRefModal({
  type,
  library,
  scenarios,
  onClose,
  onPickLibraryImage,
  onPickFile,
}: {
  type: 'image' | 'video' | 'audio'
  library: Record<string, LibraryEntry>
  scenarios: ScenarioEntry[]
  onClose: () => void
  onPickLibraryImage: (url: string, name: string, charId?: string) => void
  onPickFile: (file: File) => void | Promise<void>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const accept = type === 'image' ? 'image/*' : type === 'video' ? 'video/mp4,video/mov,video/webm' : 'audio/mp3,audio/wav,audio/mpeg'
  const title = type === 'image' ? 'Adicionar imagem ao Omni Reference' : type === 'video' ? 'Adicionar vídeo ao Omni Reference' : 'Adicionar áudio ao Omni Reference'

  // Lista todas imagens da biblioteca de personagens (flatten)
  const charImages: { url: string; name: string; charId: string; emoji: string; charName: string; index: number }[] = []
  for (const entry of Object.values(library)) {
    entry.images?.forEach((img, i) => {
      charImages.push({ url: img, name: `${entry.name} #${i + 1}`, charId: entry.charId, emoji: entry.emoji, charName: entry.name, index: i })
    })
  }

  const hasLibraryContent = type === 'image' && (charImages.length > 0 || scenarios.length > 0)

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, width: '100%', maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{ width: 30, height: 30, borderRadius: '50%', background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit' }}
          >×</button>
        </div>

        {/* Seção 1: Biblioteca */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingRight: 4 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8, letterSpacing: '0.5px' }}>📚 DA BIBLIOTECA</div>
            {!hasLibraryContent ? (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, textAlign: 'center', color: C.textDim, fontSize: 13 }}>
                {type === 'image'
                  ? 'Sua biblioteca está vazia. Adicione personagens ou cenários na aba Biblioteca.'
                  : type === 'video'
                    ? 'Ainda não há vídeos de referência na biblioteca.'
                    : 'Ainda não há áudios de referência na biblioteca.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Personagens */}
                {charImages.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>Personagens</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(100px,1fr))', gap: 8 }}>
                      {charImages.map((img, i) => (
                        <button
                          key={`${img.charId}-${img.index}`}
                          onClick={() => onPickLibraryImage(img.url, img.name, img.charId)}
                          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 6, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}
                        >
                          <img src={img.url} alt={img.name} style={{ width: '100%', aspectRatio: '1', borderRadius: 8, objectFit: 'cover' }} />
                          <div style={{ fontSize: 10, color: C.text, fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                            {img.emoji} {img.charName}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Cenários */}
                {scenarios.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>Cenários</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
                      {scenarios.map(sc => (
                        <button
                          key={sc.id}
                          onClick={() => onPickLibraryImage(sc.imageUrl, `Cenário · ${sc.name}`)}
                          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 6, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}
                        >
                          <img src={sc.imageUrl} alt={sc.name} style={{ width: '100%', aspectRatio: '16/9', borderRadius: 8, objectFit: 'cover' }} />
                          <div style={{ fontSize: 11, color: C.text, fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                            🏠 {sc.name}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Seção 2: Computador */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 8, letterSpacing: '0.5px' }}>📁 DO COMPUTADOR</div>
            <button
              onClick={() => fileRef.current?.click()}
              style={{ width: '100%', background: C.card, border: `1px dashed ${C.border}`, borderRadius: 10, padding: 20, cursor: 'pointer', color: C.textDim, fontSize: 13, fontFamily: 'inherit' }}
            >
              Clique para escolher arquivo do seu computador
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={accept}
              style={{ display: 'none' }}
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) await onPickFile(f)
              }}
            />
          </div>
        </div>

        <div style={{ fontSize: 11, color: C.textDim, textAlign: 'center' }}>Pressione ESC ou clique fora para fechar</div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Modais de movimentação
═══════════════════════════════════════════════════════════════ */

/* ══════════ SENOIDE PANEL ══════════ */
function SenoidePanel({ currentUser, clientPrices, showBrl, brlRate, library, atAssets, episodes, sceneAssets }: {
  currentUser: CurrentUser | null
  clientPrices: Record<string, number>
  showBrl?: boolean
  brlRate?: number | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  library: Record<string, any>
  atAssets: Asset[]
  episodes: Episode[]
  sceneAssets: SceneAsset[]
  voiceMap?: Record<string, { voiceId: string; voiceName: string }>
}) {
  const [subTab, setSubTab] = useState<'learn' | 'voices' | 'dialogues' | 'polyglot'>('voices')
  const [voiceAction, setVoiceAction] = useState<'describe' | 'clone' | 'library' | null>(null)
  const [voiceTarget, setVoiceTarget] = useState<string | null>(null) // charId
  const [voiceSuggestion, setVoiceSuggestion] = useState('')
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [voicePreviews, setVoicePreviews] = useState<{ id: string; audioUrl: string }[]>([])
  const [libraryVoices, setLibraryVoices] = useState<Record<string, unknown>[]>([])
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [ttsText, setTtsText] = useState('')
  const [ttsVoiceId, setTtsVoiceId] = useState('')
  const [ttsAudioUrl, setTtsAudioUrl] = useState('')
  const [ttsLoading, setTtsLoading] = useState(false)
  // Dialogues state
  const [selEpisode, setSelEpisode] = useState('')
  const [dialogueData, setDialogueData] = useState<Record<string, Record<string, { text: string; audioUrl: string; loading: boolean }>>>({})
  // Polyglot state
  const [polyType, setPolyType] = useState<'cantiga' | 'episode' | null>(null)
  const [targetLang, setTargetLang] = useState('es')
  const [polyLoading, setPolyLoading] = useState(false)
  const [polyResult, setPolyResult] = useState<{ audioUrl?: string; text?: string } | null>(null)
  const [msg, setMsg] = useState('')
  // Voice assignments from Redis (via API)
  const [voiceMap, setVoiceMap] = useState<Record<string, { voiceId: string; voiceName: string }>>({})
  useEffect(() => {
    fetch('/api/voice/map').then(r => r.json()).then(d => { if (d.map) setVoiceMap(d.map) }).catch(() => {})
  }, [])
  const refreshVoiceMap = () => {
    fetch('/api/voice/map').then(r => r.json()).then(d => { if (d.map) setVoiceMap(d.map) }).catch(() => {})
  }

  const fmt = (v: number) => showBrl && brlRate ? `R$${(v * brlRate).toFixed(2)}` : `$${v.toFixed(3)}`

  // Characters: leads + custom
  const LEADS = [
    { id: 'abraao', name: 'Abraão', emoji: '👦', desc: '8 year old boy, messy orange-red hair, brave and impulsive' },
    { id: 'abigail', name: 'Abigail', emoji: '👧', desc: '7 year old girl, dark curly hair, curious and empathetic' },
    { id: 'zaqueu', name: 'Zaqueu', emoji: '🧑', desc: '9 year old boy, mini-dreads, creative and sometimes insecure' },
    { id: 'tuba', name: 'Tuba', emoji: '🐕', desc: 'Dog, amber-orange fur, expressive eyebrows' },
    { id: 'theos', name: 'Theos', emoji: '✨', desc: 'Invisible divine presence, speaks directly to the viewer with a warm omniscient voice, never seen but always felt' },
    { id: 'miriam', name: 'Miriã', emoji: '👩', desc: 'Adult mother, curly hair, warm and guiding' },
    { id: 'elias', name: 'Elias', emoji: '👨', desc: 'Adult father, short beard, calm and impactful' },
  ]
  const customChars = atAssets.filter(a => a.type === 'character' && !a.isOfficial)
  const allChars = [...LEADS, ...customChars.map(a => ({ id: a.id, name: a.name, emoji: '🧑', desc: a.description ?? '' }))]

  const suggestVoice = async (charId: string) => {
    const char = allChars.find(c => c.id === charId)
    if (!char) return
    setVoiceLoading(true); setMsg('')
    try {
      const r = await fetch('/api/suggest-voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ characterName: char.name, characterDescription: char.desc }) })
      if (r.ok) { const d = await r.json(); setVoiceSuggestion(d.suggestion ?? '') }
      else setMsg('Erro ao sugerir voz')
    } catch { setMsg('Erro de rede') }
    finally { setVoiceLoading(false) }
  }

  const generatePreviews = async () => {
    if (!voiceSuggestion.trim()) return
    setVoiceLoading(true); setVoicePreviews([])
    try {
      const r = await fetch('/api/voice/design', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: voiceSuggestion, sampleText: 'Olá! Eu sou um personagem muito especial e estou aqui para contar histórias incríveis para vocês. Vamos compartilhar, cuidar uns dos outros e viver grandes aventuras juntos! Cada dia é uma oportunidade nova de aprender algo importante. Quando a gente divide o que tem, tudo fica melhor. Eu gosto de brincar no quintal, de correr com os amigos e de ouvir histórias antes de dormir. Às vezes eu fico com medo, mas daí eu lembro que nunca estou sozinho. Vocês querem vir comigo nessa aventura? Então vamos lá, que o dia está só começando e tem muita coisa boa esperando por nós!' }) })
      if (r.ok) { const d = await r.json(); setVoicePreviews(d.previews ?? []) }
      else setMsg('Erro ao gerar previews')
    } catch { setMsg('Erro de rede') }
    finally { setVoiceLoading(false) }
  }

  const saveDesignedVoice = async (previewId: string) => {
    if (!voiceTarget) return
    const char = allChars.find(c => c.id === voiceTarget)
    setVoiceLoading(true)
    try {
      const r = await fetch('/api/voice/assign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ previewId, characterId: voiceTarget, characterName: char?.name ?? voiceTarget, method: 'designed', description: voiceSuggestion }) })
      if (r.ok) { const d = await r.json(); refreshVoiceMap(); setMsg('✓ Voz salva!'); setVoiceAction(null); setVoicePreviews([]) }
    } catch { setMsg('Erro ao salvar') }
    finally { setVoiceLoading(false) }
  }

  const searchLibrary = async () => {
    setLibraryLoading(true)
    try {
      const r = await fetch('/api/voice/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ search: librarySearch }) })
      if (r.ok) { const d = await r.json(); setLibraryVoices(d.voices ?? []) }
    } catch {}
    finally { setLibraryLoading(false) }
  }

  const generateTTS = async () => {
    if (!ttsText.trim() || !ttsVoiceId) { setMsg('Escreva o texto e selecione uma voz.'); return }
    setTtsLoading(true); setTtsAudioUrl('')
    try {
      const r = await fetch('/api/voice/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: ttsText, voiceId: ttsVoiceId }) })
      if (r.ok) { const d = await r.json(); setTtsAudioUrl(d.audioUrl ?? '') }
      else { const d = await r.json().catch(() => ({})); setMsg(d.error ?? 'Erro ao gerar') }
    } catch { setMsg('Erro de rede') }
    finally { setTtsLoading(false) }
  }

  const inputStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%' }
  const btnP = { background: C.purple, border: 'none', borderRadius: 8, padding: '10px 18px', color: '#fff', fontSize: 13, fontWeight: 700 as const, cursor: 'pointer', fontFamily: 'inherit' }
  const btnS = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 18px', color: C.textDim, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 28 }}>🎙</span>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Senoide</div>
          <div style={{ fontSize: 13, color: C.textDim }}>Crie vozes, diálogos e traduções para seus personagens e cantigas.</div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, background: C.card, padding: 4, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 18 }}>
        {([['learn', '🎓 Aprender'], ['voices', '🗣 Vozes'], ['dialogues', '🎭 Diálogos'], ['polyglot', '🌍 Poliglota']] as [typeof subTab, string][]).map(([id, lbl]) => (
          <button key={id} onClick={() => { setSubTab(id); setMsg(''); setVoiceAction(null); setVoiceTarget(null) }} style={{ flex: 1, padding: '10px', borderRadius: 8, background: subTab === id ? C.surface : 'transparent', border: subTab === id ? `1px solid ${C.border}` : '1px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: subTab === id ? C.text : C.textDim, fontFamily: 'inherit' }}>{lbl}</button>
        ))}
      </div>

      {msg && <div style={{ background: msg.startsWith('✓') ? `${C.green}15` : `${C.red}15`, border: `1px solid ${msg.startsWith('✓') ? C.green : C.red}30`, borderRadius: 8, padding: 10, fontSize: 12, color: msg.startsWith('✓') ? C.green : C.red, marginBottom: 12 }}>{msg}</div>}

      {/* ═══ APRENDER ═══ */}
      {subTab === 'learn' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Domine a arte de dar voz aos personagens</div>
          <div style={{ fontSize: 12, color: C.textDim }}>A forma como você escreve muda como a voz soa. Use estas técnicas:</div>
          {[
            ['! para entusiasmo', '"Eu quero dividir o pão com você!"'],
            ['... para hesitação', '"Eu... quero dividir o pão... com você."'],
            ['CAPS para ênfase', '"EU QUERO dividir o pão com VOCÊ!"'],
            ['— para pausa', '"Eu quero dividir o pão — com você."'],
            ['(tom) para direção', '"(sussurrando) Eu quero dividir o pão..."'],
            ['♪ para cantar', '"♪ Eu quero dividir o pão com você ♪"'],
          ].map(([tip, example]) => (
            <div key={tip} style={{ background: C.card, borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, marginBottom: 4 }}>{tip}</div>
              <div style={{ fontSize: 13, color: C.text, fontFamily: 'monospace' }}>{example}</div>
            </div>
          ))}
          <div style={{ background: C.surface, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8 }}>Laboratório</div>
            <textarea value={ttsText} onChange={e => setTtsText(e.target.value)} placeholder="Escreva seu texto aqui e ouça como soa..." rows={3} style={{ ...inputStyle, resize: 'vertical', marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={ttsVoiceId} onChange={e => setTtsVoiceId(e.target.value)} style={{ ...inputStyle, width: 200 }}>
                <option value="">Selecionar voz...</option>
                {Object.entries(voiceMap).map(([charId, v]) => <option key={charId} value={v.voiceId}>{v.voiceName || charId}</option>)}
              </select>
              <button onClick={generateTTS} disabled={ttsLoading} style={{ ...btnP, opacity: ttsLoading ? 0.6 : 1 }}>{ttsLoading ? 'Gerando...' : '▶ Gerar e ouvir'}</button>
              <span style={{ fontSize: 11, color: C.textDim }}>Custo: {fmt((ttsText.length / 100) * (clientPrices['elevenlabs-tts'] ?? 0.003))}</span>
            </div>
            {ttsAudioUrl && <audio controls src={ttsAudioUrl} style={{ width: '100%', marginTop: 10 }} />}
          </div>
          <div style={{ fontSize: 10, color: C.textDim, fontStyle: 'italic', marginTop: 8 }}>Diretrizes baseadas nas especificações da ElevenLabs, nosso parceiro oficial de síntese de voz.</div>
        </div>
      )}

      {/* ═══ VOZES ═══ */}
      {subTab === 'voices' && !voiceAction && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Vozes dos Personagens</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {allChars.map(c => {
              const hasVoice = !!voiceMap[c.id]
              return (
                <div key={c.id} style={{ background: C.card, border: `1px solid ${hasVoice ? C.green + '60' : C.border}`, borderRadius: 12, padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 6 }}>{c.emoji}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{c.name}</div>
                  {hasVoice ? (
                    <div>
                      <div style={{ fontSize: 11, color: C.green, marginBottom: 8 }}>🎙✓ Voz configurada</div>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button onClick={async () => {
                          setTtsLoading(true); setMsg('')
                          try {
                            const r = await fetch('/api/voice/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `Olá! Eu sou ${c.name}.`, voiceId: voiceMap[c.id].voiceId }) })
                            if (r.ok) { const d = await r.json(); setTtsAudioUrl(d.audioUrl ?? '') }
                            else setMsg('Erro ao gerar áudio')
                          } catch { setMsg('Erro de rede') }
                          finally { setTtsLoading(false) }
                        }} style={{ ...btnS, padding: '4px 10px', fontSize: 11 }}>▶ Ouvir</button>
                        <button onClick={() => { setVoiceTarget(c.id); setVoiceAction('describe'); suggestVoice(c.id) }} style={{ ...btnS, padding: '4px 10px', fontSize: 11 }}>✏ Mudar</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setVoiceTarget(c.id); setVoiceAction(null); setVoiceSuggestion(''); setVoicePreviews([]) }} style={{ ...btnP, padding: '6px 14px', fontSize: 12 }}>+ Criar voz</button>
                  )}
                </div>
              )
            })}
          </div>
          {/* Escolha de método quando voiceTarget setado mas sem action */}
          {voiceTarget && !voiceAction && (
            <div style={{ background: C.surface, border: `1px solid ${C.gold}40`, borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Criar voz para {allChars.find(c => c.id === voiceTarget)?.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div onClick={() => { setVoiceAction('describe'); suggestVoice(voiceTarget) }} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>📝</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Descrever</div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>IA sugere a voz a partir do personagem</div>
                </div>
                <div onClick={() => { setVoiceAction('clone') }} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🎤</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Clonar</div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>Grave ou suba áudio de referência</div>
                </div>
                <div onClick={() => { setVoiceAction('library'); searchLibrary() }} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>📚</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Biblioteca</div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>Escolha entre 10.000+ vozes</div>
                </div>
              </div>
              <button onClick={() => { setVoiceTarget(null); setVoiceAction(null); setVoiceSuggestion(''); setVoicePreviews([]) }} style={{ ...btnS, marginTop: 12 }}>← Cancelar</button>
            </div>
          )}
        </div>
      )}

      {/* DESCREVER VOZ */}
      {subTab === 'voices' && voiceAction === 'describe' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => { setVoiceAction(null); setVoiceTarget(null); setVoiceSuggestion(""); setVoicePreviews([]) }} style={{ ...btnS, padding: "4px 12px" }}>←</button>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Descrever voz · {allChars.find(c => c.id === voiceTarget)?.name}</div>
          </div>
          <div style={{ background: C.surface, borderRadius: 10, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.gold }}>DESCRIÇÃO DA VOZ</div>
              <button onClick={() => { if (voiceTarget) suggestVoice(voiceTarget) }} disabled={voiceLoading} style={{ background: 'transparent', border: `1px solid ${C.gold}40`, borderRadius: 6, padding: '3px 10px', fontSize: 10, color: C.gold, cursor: 'pointer', fontFamily: 'inherit' }}>{voiceLoading ? '...' : '✨ Pedir sugestão da IA'}</button>
            </div>
            <textarea value={voiceSuggestion} onChange={e => setVoiceSuggestion(e.target.value)} placeholder='Descreva a voz em inglês. Ex: "Perfect audio quality. Young Brazilian boy, 8 years old, warm and enthusiastic tone, slightly high-pitched, São Paulo accent, cheerful personality."' rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
            <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>Escreva ou edite a descrição da voz. Clique "Pedir sugestão" para a IA preencher automaticamente.</div>
          </div>
          <button onClick={generatePreviews} disabled={voiceLoading || !voiceSuggestion.trim()} style={{ ...btnP, alignSelf: 'flex-start', opacity: voiceLoading ? 0.6 : 1 }}>{voiceLoading ? 'Gerando...' : '🎙 Gerar 3 previews'}</button>
          {voicePreviews.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {voicePreviews.map((p, i) => (
                <div key={i} style={{ background: C.card, borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Preview {i + 1}</span>
                  {p.audioUrl ? <audio controls src={p.audioUrl} style={{ flex: 1, height: 32 }} /> : <span style={{ flex: 1, fontSize: 11, color: C.textDim }}>Áudio não disponível</span>}
                  <button onClick={() => saveDesignedVoice(p.id)} disabled={voiceLoading || !p.id} style={{ ...btnP, opacity: p.id ? 1 : 0.4 }}>Usar esta ✓</button>
                </div>
              ))}
              <button onClick={generatePreviews} style={btnS}>🔄 Gerar novos</button>
            </div>
          )}
        </div>
      )}

      {/* BIBLIOTECA */}
      {subTab === 'voices' && voiceAction === 'library' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => { setVoiceAction(null); setVoiceTarget(null); setVoiceSuggestion(""); setVoicePreviews([]) }} style={{ ...btnS, padding: "4px 12px" }}>←</button>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Biblioteca de Vozes</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={librarySearch} onChange={e => setLibrarySearch(e.target.value)} placeholder="Buscar: feminino, criança, brasileiro..." style={{ ...inputStyle, flex: 1 }} onKeyDown={e => e.key === 'Enter' && searchLibrary()} />
            <button onClick={searchLibrary} disabled={libraryLoading} style={btnP}>{libraryLoading ? '...' : '🔍 Buscar'}</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {libraryVoices.map((v: Record<string, unknown>) => (
              <div key={v.id as string} style={{ background: C.card, borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{v.name as string}</div>
                  <div style={{ fontSize: 11, color: C.textDim }}>{v.gender as string} · {v.age as string} · {v.accent as string}</div>
                </div>
                {v.previewUrl ? <audio controls src={String(v.previewUrl)} style={{ height: 32 }} /> : null}
                <button onClick={async () => { if (voiceTarget) {
                  const char = allChars.find(c => c.id === voiceTarget)
                  await fetch('/api/voice/assign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ characterId: voiceTarget, characterName: char?.name, voiceId: v.id, voiceName: v.name, method: 'library' }) })
                  refreshVoiceMap(); setMsg('✓ Voz vinculada!'); setVoiceAction(null); setVoiceTarget(null)
                } }} style={btnP}>Usar ✓</button>
              </div>
            ))}
            {libraryVoices.length === 0 && !libraryLoading && <div style={{ color: C.textDim, textAlign: 'center', padding: 20 }}>Busque para encontrar vozes.</div>}
          </div>
        </div>
      )}

      {/* CLONAR */}
      {subTab === 'voices' && voiceAction === 'clone' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => { setVoiceAction(null); setVoiceTarget(null); setVoiceSuggestion(""); setVoicePreviews([]) }} style={{ ...btnS, padding: "4px 12px" }}>←</button>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Clonar voz · {allChars.find(c => c.id === voiceTarget)?.name}</div>
          </div>
          <div style={{ background: C.surface, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>Suba um arquivo de áudio (MP3/WAV, mínimo 30 segundos) imitando como o personagem falaria.</div>
            <input type="file" accept="audio/*" onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file || !voiceTarget) return
              setVoiceLoading(true)
              try {
                const formData = new FormData(); formData.append('file', file)
                const upRes = await fetch('/api/blob-upload', { method: 'POST', body: formData })
                if (!upRes.ok) { setMsg('Erro no upload'); return }
                const { url } = await upRes.json()
                const char = allChars.find(c => c.id === voiceTarget)
                const r = await fetch('/api/voice/clone', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: char?.name ?? voiceTarget, audioUrl: url }) })
                if (r.ok) { const d = await r.json(); refreshVoiceMap(); setMsg('✓ Voz clonada!'); setVoiceAction(null) }
                else setMsg('Erro ao clonar')
              } catch { setMsg('Erro') }
              finally { setVoiceLoading(false) }
            }} style={{ fontSize: 12, color: C.textDim }} />
            {voiceLoading && <div style={{ color: C.gold, fontSize: 12, marginTop: 8 }}>Clonando voz...</div>}
          </div>
        </div>
      )}

      {/* ═══ DIÁLOGOS ═══ */}
      {subTab === 'dialogues' && (() => {
        const epScenes = selEpisode ? sceneAssets.filter(s => s.episodeId === selEpisode) : []

        const generateDialogue = async (sceneId: string, charId: string, text: string) => {
          const voice = voiceMap[charId]
          if (!voice?.voiceId || !text.trim()) { setMsg(voice ? 'Escreva o diálogo.' : 'Configure a voz primeiro.'); return }
          setDialogueData(prev => ({ ...prev, [sceneId]: { ...prev[sceneId], [charId]: { text, audioUrl: '', loading: true } } }))
          try {
            const r = await fetch('/api/voice/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voiceId: voice.voiceId }) })
            if (r.ok) { const d = await r.json(); setDialogueData(prev => ({ ...prev, [sceneId]: { ...prev[sceneId], [charId]: { text, audioUrl: d.audioUrl ?? '', loading: false } } })) }
            else { setDialogueData(prev => ({ ...prev, [sceneId]: { ...prev[sceneId], [charId]: { text, audioUrl: '', loading: false } } })); setMsg('Erro ao gerar áudio') }
          } catch { setDialogueData(prev => ({ ...prev, [sceneId]: { ...prev[sceneId], [charId]: { text, audioUrl: '', loading: false } } })) }
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Diálogos por Episódio</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: C.textDim }}>Episódio:</span>
              <select value={selEpisode} onChange={e => setSelEpisode(e.target.value)} style={inputStyle}>
                <option value="">Selecione...</option>
                {episodes.map(ep => <option key={ep.id} value={ep.id}>{ep.name || ep.id}</option>)}
              </select>
            </div>

            {selEpisode && epScenes.length === 0 && (
              <div style={{ color: C.textDim, textAlign: 'center', padding: 20 }}>Nenhuma cena neste episódio.</div>
            )}

            {epScenes.map((scene, si) => (
              <div key={scene.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>Cena {scene.sceneNumber ?? si + 1} · {scene.duration}s</span>
                    {scene.title && <span style={{ fontSize: 12, color: C.text, marginLeft: 8 }}>{scene.title}</span>}
                    <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>{scene.prompt?.slice(0, 80)}{scene.prompt?.length > 80 ? '...' : ''}</div>
                  </div>
                  {scene.videoUrl && (
                    <video
                      src={scene.videoUrl}
                      controls
                      muted
                      playsInline
                      preload="metadata"
                      style={{ width: 120, height: 68, borderRadius: 6, objectFit: 'cover', flexShrink: 0, cursor: 'pointer' }}
                    />
                  )}
                </div>
                {scene.characters.map(charId => {
                  const char = allChars.find(c => c.id === charId)
                  const hasVoice = !!voiceMap[charId]
                  const dialog = dialogueData[scene.id]?.[charId]
                  return (
                    <div key={charId} style={{ marginBottom: 10, paddingLeft: 8, borderLeft: `2px solid ${hasVoice ? C.purple : C.border}` }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: hasVoice ? C.purple : C.textDim, marginBottom: 4 }}>
                        {char?.emoji ?? '🧑'} {char?.name ?? charId} {hasVoice ? '🎙✓' : '⚠ sem voz'}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                        <textarea
                          defaultValue={dialog?.text ?? ''}
                          placeholder={hasVoice ? '(animado) Escreva o diálogo aqui...' : 'Configure a voz primeiro em Vozes'}
                          disabled={!hasVoice}
                          rows={2}
                          style={{ ...inputStyle, flex: 1, resize: 'vertical', fontSize: 12, opacity: hasVoice ? 1 : 0.5 }}
                          onBlur={e => setDialogueData(prev => ({ ...prev, [scene.id]: { ...prev[scene.id], [charId]: { text: e.target.value, audioUrl: dialog?.audioUrl ?? '', loading: false } } }))}
                        />
                        <button
                          onClick={() => { const txt = dialogueData[scene.id]?.[charId]?.text; if (txt) generateDialogue(scene.id, charId, txt) }}
                          disabled={!hasVoice || dialog?.loading}
                          style={{ ...btnP, padding: '8px 12px', fontSize: 11, opacity: hasVoice ? 1 : 0.4 }}
                        >{dialog?.loading ? '...' : '▶'}</button>
                      </div>
                      {dialog?.audioUrl && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                          <audio controls src={dialog.audioUrl} style={{ flex: 1, height: 28 }} />
                          <button onClick={() => generateDialogue(scene.id, charId, dialog.text)} style={{ ...btnS, padding: '4px 8px', fontSize: 10 }}>🔄</button>
                          <a href={dialog.audioUrl} download style={{ ...btnS, padding: '4px 8px', fontSize: 10, textDecoration: 'none' }}>⬇</a>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}

            {selEpisode && epScenes.length > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => {
                  // Exporta todos os áudios gerados
                  const audios = Object.entries(dialogueData).flatMap(([sceneId, chars]) =>
                    Object.entries(chars).filter(([, d]) => d.audioUrl).map(([charId, d]) => ({ sceneId, charId, ...d }))
                  )
                  if (!audios.length) { setMsg('Nenhum áudio gerado ainda.'); return }
                  setMsg(`${audios.length} áudio(s) prontos para download individual.`)
                }} style={btnS}>⬇ Info dos áudios ({Object.values(dialogueData).reduce((s, chars) => s + Object.values(chars).filter(d => d.audioUrl).length, 0)})</button>
              </div>
            )}
          </div>
        )
      })()}

      {/* ═══ POLIGLOTA ═══ */}
      {subTab === 'polyglot' && (() => {
        const LANGUAGES = [
          { id: 'es', name: 'Espanhol' }, { id: 'en', name: 'Inglês' },
          { id: 'fr', name: 'Francês' }, { id: 'de', name: 'Alemão' },
          { id: 'it', name: 'Italiano' }, { id: 'ja', name: 'Japonês' },
          { id: 'ko', name: 'Coreano' }, { id: 'zh', name: 'Chinês' },
          { id: 'hi', name: 'Hindi' }, { id: 'ar', name: 'Árabe' },
        ]

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Poliglota</div>
            <div style={{ fontSize: 12, color: C.textDim }}>Traduza suas cantigas e episódios para outros idiomas. A voz original é preservada — só o idioma muda.</div>

            {!polyType && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div onClick={() => setPolyType('cantiga')} style={{ background: C.surface, border: `1px solid ${C.gold}40`, borderRadius: 14, padding: 24, cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎵</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Cantiga</div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>Traduz o áudio mantendo a mesma voz</div>
                </div>
                <div onClick={() => setPolyType('episode')} style={{ background: C.surface, border: `1px solid ${C.purple}40`, borderRadius: 14, padding: 24, cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📺</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Episódio</div>
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>Traduz os diálogos para outro idioma</div>
                </div>
              </div>
            )}

            {polyType === 'cantiga' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button onClick={() => setPolyType(null)} style={{ ...btnS, alignSelf: 'flex-start', padding: '4px 12px', fontSize: 11 }}>← Voltar</button>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Traduzir Cantiga</div>
                <div style={{ fontSize: 12, color: C.textDim }}>A tradução usa a API de Dubbing da ElevenLabs. O áudio original é traduzido mantendo a mesma voz.</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: C.textDim }}>Para:</span>
                  <select value={targetLang} onChange={e => setTargetLang(e.target.value)} style={inputStyle}>
                    {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div style={{ background: C.surface, borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 8 }}>ORIGEM DO ÁUDIO</div>

                  {/* Opção 1: Upload de arquivo */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: C.textDim, marginBottom: 6 }}>Suba o arquivo de áudio (MP3/WAV):</div>
                    <input type="file" accept="audio/*" id="poly-audio-upload" style={{ fontSize: 12, color: C.textDim }} onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      try {
                        const formData = new FormData(); formData.append('file', file)
                        const r = await fetch('/api/blob-upload', { method: 'POST', body: formData })
                        if (r.ok) {
                          const d = await r.json()
                          setPolyResult({ audioUrl: d.url, text: `Arquivo "${file.name}" carregado. Clique Traduzir.` })
                        }
                      } catch { setMsg('Erro no upload.') }
                    }} />
                    {polyResult?.audioUrl && (
                      <div style={{ marginTop: 8 }}>
                        <audio controls src={polyResult.audioUrl} style={{ width: '100%' }} />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={async () => {
                      if (!polyResult?.audioUrl) { setMsg('Suba o arquivo de áudio primeiro.'); return }
                      setPolyLoading(true)
                      try {
                        setMsg('A tradução por dubbing será integrada com a API ElevenLabs em breve. O arquivo foi carregado e está pronto para quando a funcionalidade estiver disponível.')
                      } catch { setMsg('Erro') }
                      finally { setPolyLoading(false) }
                    }} disabled={polyLoading || !polyResult?.audioUrl} style={{ ...btnP, opacity: polyLoading || !polyResult?.audioUrl ? 0.6 : 1 }}>{polyLoading ? 'Traduzindo...' : '🌍 Traduzir'}</button>
                  </div>
                </div>
                {polyResult && (
                  <div style={{ background: `${C.gold}10`, border: `1px solid ${C.gold}30`, borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 12, color: C.gold }}>{polyResult.text}</div>
                  </div>
                )}
              </div>
            )}

            {polyType === 'episode' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button onClick={() => setPolyType(null)} style={{ ...btnS, alignSelf: 'flex-start', padding: '4px 12px', fontSize: 11 }}>← Voltar</button>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Traduzir Episódio</div>
                <div style={{ fontSize: 12, color: C.textDim }}>Os diálogos de cada cena são traduzidos e regenerados com as mesmas vozes dos personagens em outro idioma.</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: C.textDim }}>Episódio:</span>
                  <select style={inputStyle}>
                    <option value="">Selecione...</option>
                    {episodes.map(ep => <option key={ep.id} value={ep.id}>{ep.name || ep.id}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: C.textDim }}>Para:</span>
                  <select value={targetLang} onChange={e => setTargetLang(e.target.value)} style={inputStyle}>
                    {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <label style={{ fontSize: 12, color: C.text, display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" defaultChecked style={{ accentColor: C.purple }} /> Diálogos dos personagens</label>
                  <label style={{ fontSize: 12, color: C.text, display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" defaultChecked style={{ accentColor: C.purple }} /> Gerar legendas (SRT)</label>
                </div>
                <div style={{ background: C.surface, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, color: C.textDim }}>Os vídeos das cenas permanecem iguais. O áudio traduzido é exportado separadamente. Na edição final, substitua a faixa de áudio.</div>
                </div>
                <button onClick={() => setMsg('A tradução de episódios será integrada com a API de Dubbing da ElevenLabs em breve. Por enquanto, escreva os diálogos traduzidos na aba Diálogos.')} style={btnP}>🌍 Traduzir episódio</button>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

/* ══════════ CANTIGAS WIZARD ══════════ */
function CantigasWizard({ currentUser, clientPrices, showBrl, brlRate, onGoToStudio }: {
  currentUser: CurrentUser | null
  clientPrices: Record<string, number>
  showBrl?: boolean
  brlRate?: number | null
  onGoToStudio?: (prompt: string, audioUrl: string, duration: number, chars: string[]) => void
}) {
  const [mode, setMode] = useState<'create' | 'upload' | null>(null)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [idea, setIdea] = useState('')
  const [theme, setTheme] = useState('')
  const [characters, setCharacters] = useState<string[]>([])
  const [lyrics, setLyrics] = useState('')
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [style, setStyle] = useState("children's christian song, gentle acoustic guitar, warm and sweet child female vocals singing in Brazilian Portuguese, São Paulo accent")
  const [musicUrl, setMusicUrl] = useState('')
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState('')
  const [musicDuration, setMusicDuration] = useState('1:30')
  const [refraoCount, setRefraoCount] = useState(1)
  const [useRhyme, setUseRhyme] = useState(true)
  const [musicLoading, setMusicLoading] = useState(false)
  const [storyboard, setStoryboard] = useState<{ cena: number; trecho: string; duracao: number; personagens: string[]; cenario: string; acao: string; prompt_en: string; videoUrl?: string; videoStatus?: string }[]>([])
  const [storyboardLoading, setStoryboardLoading] = useState(false)
  const [error, setError] = useState('')
  const [assetsPhase, setAssetsPhase] = useState(false)
  const [currentAssetIdx, setCurrentAssetIdx] = useState(0)

  // Extrai lista flat de assets necessários do storyboard
  const neededAssets = useMemo(() => {
    const assets: { type: 'personagem' | 'cenario' | 'prop'; id: string; nome: string; cenas: number[]; suggestion?: string }[] = []
    const seen = new Set<string>()
    for (const s of storyboard) {
      for (const p of (s.personagens ?? [])) {
        if (!seen.has(`char_${p}`)) {
          seen.add(`char_${p}`)
          assets.push({ type: 'personagem', id: p, nome: p, cenas: [s.cena] })
        } else {
          const existing = assets.find(a => a.id === p && a.type === 'personagem')
          if (existing && !existing.cenas.includes(s.cena)) existing.cenas.push(s.cena)
        }
      }
      if (s.cenario && !seen.has(`cen_${s.cenario}`)) {
        seen.add(`cen_${s.cenario}`)
        assets.push({ type: 'cenario', id: s.cenario.toLowerCase().replace(/\s+/g, '_'), nome: s.cenario, cenas: [s.cena] })
      } else if (s.cenario) {
        const existing = assets.find(a => a.nome === s.cenario && a.type === 'cenario')
        if (existing && !existing.cenas.includes(s.cena)) existing.cenas.push(s.cena)
      }
    }
    return assets
  }, [storyboard])

  // Verifica quais assets já existem — por ora todos começam como pending
  // O creator marca como "Já tenho" ou cria
  const [readyAssetIds, setReadyAssetIds] = useState<Set<string>>(new Set())
  const assetStatus = useMemo(() => {
    return neededAssets.map(a => ({
      ...a,
      ready: readyAssetIds.has(`${a.type}_${a.id}`),
    }))
  }, [neededAssets, readyAssetIds])

  const pendingAssets = assetStatus.filter(a => !a.ready)
  const allAssetsReady = pendingAssets.length === 0

  // ── Persistência ──
  const [cantigaId, setCantigaId] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [minhasCantigas, setMinhasCantigas] = useState<Record<string, any>[]>([])
  const [loadingList, setLoadingList] = useState(true)

  // Carrega lista de cantigas do user
  const loadMinhasCantigas = useCallback(async () => {
    try {
      const r = await fetch('/api/cantigas')
      if (r.ok) { const d = await r.json(); setMinhasCantigas(d.cantigas ?? []) }
    } catch {} finally { setLoadingList(false) }
  }, [])
  useEffect(() => { loadMinhasCantigas() }, [loadMinhasCantigas])

  // Auto-save: salva estado atual no Redis
  const autoSave = useCallback(async (overrides?: Record<string, unknown>) => {
    const statusMap: Record<number, string> = { 1: 'lyrics', 2: 'music', 3: 'storyboard', 4: 'producing' }
    const data = {
      title: title || 'Nova cantiga',
      status: statusMap[step] ?? 'lyrics',
      step,
      idea, theme, characters, lyrics, musicDuration, refraoCount, useRhyme,
      musicUrl, musicStyle: style, storyboard,
      ...overrides,
    }
    try {
      if (cantigaId) {
        await fetch(`/api/cantigas/${cantigaId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      } else {
        const r = await fetch('/api/cantigas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        if (r.ok) { const d = await r.json(); setCantigaId(d.cantiga?.id ?? null) }
      }
    } catch {}
  }, [cantigaId, title, step, idea, theme, characters, lyrics, musicDuration, refraoCount, useRhyme, musicUrl, style, storyboard])

  // Restaura cantiga existente
  const loadCantiga = (c: Record<string, any>) => {
    setCantigaId(c.id)
    setTitle(c.title ?? '')
    setIdea(c.idea ?? '')
    setTheme(c.theme ?? '')
    setCharacters(c.characters ?? [])
    setLyrics(c.lyrics ?? '')
    setMusicDuration(c.musicDuration ?? '1:30')
    setRefraoCount(c.refraoCount ?? 1)
    setUseRhyme(c.useRhyme ?? true)
    setMusicUrl(c.musicUrl ?? '')
    setStyle(c.musicStyle ?? style)
    setStoryboard(c.storyboard ?? [])
    setStep(c.step ?? 1)
    setMode(c.musicUrl && !c.idea ? 'upload' : 'create')
  }

  const fmt = (v: number) => showBrl && brlRate ? `R$${(v * brlRate).toFixed(2)}` : `$${v.toFixed(3)}`
  const CHARS = [
    { id: 'abraao', name: 'Abraão', emoji: '👦' },
    { id: 'abigail', name: 'Abigail', emoji: '👧' },
    { id: 'zaqueu', name: 'Zaqueu', emoji: '🧑' },
    { id: 'tuba', name: 'Tuba', emoji: '🐕' },
    { id: 'miriam', name: 'Miriã', emoji: '👩' },
    { id: 'elias', name: 'Elias', emoji: '👨' },
  ]
  const THEMES = ['Compartilhar', 'Perdão', 'Amizade', 'Coragem', 'Gratidão', 'Obediência', 'Amor ao próximo', 'Cuidar da natureza']

  const generateLyrics = async () => {
    setLyricsLoading(true); setError('')
    try {
      const r = await fetch('/api/lyrics-director', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'lyrics',
          prompt: idea
            + `\n\nDuração alvo: ${musicDuration} (ajuste a quantidade de versos para caber nesse tempo)`
            + `\nO refrão deve aparecer ${refraoCount} vez(es) ao longo da cantiga.`
            + (useRhyme ? '\nUse rimas consistentes (AABB ou ABAB).' : '\nNão precisa rimar. Priorize naturalidade e fluidez.'),
          characters,
          theme,
        }),
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error ?? 'Erro'); return }
      const d = await r.json()
      setLyrics(d.result ?? '')
      // Extrai título da primeira linha
      const titleMatch = d.result?.match(/\*\*(.*?)\*\*/)
      if (titleMatch) setTitle(titleMatch[1])
    } catch { setError('Erro de rede') }
    finally { setLyricsLoading(false) }
  }

  const generateMusic = async () => {
    if (!lyrics.trim()) { setError('Escreva ou gere a letra primeiro.'); return }
    setMusicLoading(true); setError(''); setMusicUrl('')
    try {
      const r = await fetch('/api/generate-music', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: lyrics, title: title || 'Cantiga AAZ', style, customMode: true, instrumental: false }),
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error ?? 'Erro ao gerar música'); return }
      const d = await r.json()
      if (d.status === 'processing') { setError(`Música em processamento (ID: ${d.taskId}). Aguarde e tente novamente.`); return }
      setMusicUrl(d.musicUrl ?? '')
      if (d.musicUrl) autoSave({ musicUrl: d.musicUrl, status: 'music' })
      if (!d.musicUrl) setError('Música gerada mas URL não retornada. Tente novamente.')
    } catch { setError('Erro de rede') }
    finally { setMusicLoading(false) }
  }

  const generateStoryboard = async () => {
    if (!lyrics.trim()) return
    setStoryboardLoading(true); setError('')
    try {
      const r = await fetch('/api/lyrics-director', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'storyboard', prompt: lyrics }),
      })
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error ?? 'Erro'); return }
      const d = await r.json()
      setStoryboard(d.storyboard ?? [])
      if (!d.storyboard?.length) setError('Não foi possível gerar o storyboard. Tente novamente.')
    } catch { setError('Erro de rede') }
    finally { setStoryboardLoading(false) }
  }

  const inputStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%' }
  const btnPrimary = { background: C.gold, border: 'none', borderRadius: 8, padding: '10px 20px', color: '#000', fontSize: 13, fontWeight: 700 as const, cursor: 'pointer', fontFamily: 'inherit' }
  const btnSecondary = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 20px', color: C.textDim, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const formData = new FormData()
      formData.append('file', file)
      const r = await fetch('/api/blob-upload', { method: 'POST', body: formData })
      if (r.ok) {
        const d = await r.json()
        setUploadedAudioUrl(d.url)
        setMusicUrl(d.url)
        setTitle(file.name.replace(/\.\w+$/, ''))
      }
    } catch { setError('Erro ao fazer upload do áudio.') }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 28 }}>🎵</span>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>Cantigas</div>
          <div style={{ fontSize: 13, color: C.textDim }}>Crie cantigas infantis cristãs do zero ou dê vida à sua cantiga existente.</div>
        </div>
      </div>

      {/* Seletor de modo */}
      {!mode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div onClick={() => { setMode('create'); setStep(1); setCantigaId(null); setTitle(''); setIdea(''); setLyrics(''); setMusicUrl(''); setStoryboard([]) }} style={{ background: C.surface, border: `1px solid ${C.gold}40`, borderRadius: 14, padding: 28, cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.15s' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>Criar do zero</div>
              <div style={{ fontSize: 12, color: C.textDim }}>IA escreve a letra, gera a música e cria o roteiro visual cena a cena.</div>
            </div>
            <div onClick={() => { setMode('upload'); setStep(2); setCantigaId(null); setTitle(''); setLyrics(''); setMusicUrl(''); setStoryboard([]) }} style={{ background: C.surface, border: `1px solid ${C.purple}40`, borderRadius: 14, padding: 28, cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.15s' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎤</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>Dê vida à sua cantiga!</div>
              <div style={{ fontSize: 12, color: C.textDim }}>Suba uma cantiga que você já tem (MP3/WAV), cole a letra e gere o roteiro visual.</div>
            </div>
          </div>

          {/* Minhas Cantigas */}
          {loadingList ? (
            <div style={{ color: C.textDim, fontSize: 12 }}>Carregando cantigas...</div>
          ) : minhasCantigas.length > 0 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Minhas Cantigas</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {minhasCantigas.map((c: Record<string, any>) => {
                  const statusLabels: Record<string, string> = { lyrics: 'Escrevendo letra', music: 'Gerando música', storyboard: 'Criando roteiro', assets: 'Criando assets', producing: 'Produzindo', completed: 'Completa' }
                  const statusColors: Record<string, string> = { lyrics: C.gold, music: C.purple, storyboard: C.blue, assets: C.gold, producing: C.green, completed: C.green }
                  const scenes = c.storyboard?.length ?? 0
                  const scenesReady = c.storyboard?.filter((s: Record<string, any>) => s.videoStatus === 'ready').length ?? 0
                  const hasMusic = !!c.musicUrl
                  const hasLyrics = !!c.lyrics
                  const hasStoryboard = scenes > 0
                  return (
                    <div key={c.id} onClick={() => loadCantiga(c)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, cursor: 'pointer', transition: 'border-color 0.15s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{c.title || 'Sem título'}</div>
                        <span style={{ fontSize: 9, fontWeight: 700, color: statusColors[c.status] ?? C.textDim, background: `${statusColors[c.status] ?? C.textDim}20`, padding: '2px 8px', borderRadius: 4 }}>{statusLabels[c.status] ?? c.status}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: C.textDim }}>
                        <div>{hasLyrics ? '✓' : '○'} Letra {hasMusic ? '· ✓ Música' : ''}</div>
                        <div>{hasStoryboard ? `✓ Roteiro (${scenes} cenas)` : '○ Roteiro'} {scenesReady > 0 ? `· 🎬 ${scenesReady}/${scenes}` : ''}</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                        <span style={{ fontSize: 10, color: C.textDim }}>{new Date(c.updatedAt).toLocaleDateString('pt-BR')}</span>
                        <span style={{ fontSize: 11, color: C.blue, fontWeight: 600 }}>Continuar →</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {mode && (<>
        {/* Botão voltar ao início */}
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => { setMode(null); setStep(1); setLyrics(''); setMusicUrl(''); setStoryboard([]); setError('') }} style={{ background: 'transparent', border: 'none', color: C.blue, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>← Voltar ao início</button>
        </div>

        {/* Steps indicator */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {(mode === 'upload'
            ? ['Áudio + Letra', 'Roteiro Visual', 'Produção']
            : ['Ideia + Letra', 'Música', 'Roteiro Visual', 'Produção']
          ).map((lbl, i) => {
            const stepNum = mode === 'upload' ? i + 2 : i + 1
            return (
              <div key={i} style={{ flex: 1, padding: '8px', borderRadius: 6, background: step === stepNum ? C.gold + '20' : C.card, border: `1px solid ${step === stepNum ? C.gold : C.border}`, textAlign: 'center', fontSize: 11, fontWeight: 700, color: step === stepNum ? C.gold : step > stepNum ? C.green : C.textDim }}>
                {step > stepNum ? '✓ ' : ''}{lbl}
              </div>
            )
          })}
        </div>

        {error && <div style={{ background: `${C.red}15`, border: `1px solid ${C.red}30`, borderRadius: 8, padding: 12, fontSize: 12, color: C.red, marginBottom: 14 }}>{error}</div>}

        {/* MODO UPLOAD — Passo 2: Áudio + Letra */}
        {mode === 'upload' && step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6 }}>SUBA SUA CANTIGA (MP3/WAV)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="file" accept="audio/*" onChange={handleAudioUpload} style={{ fontSize: 12, color: C.textDim }} />
              </div>
              {musicUrl && (
                <div style={{ marginTop: 10 }}>
                  <audio controls src={musicUrl} style={{ width: '100%' }} />
                  <div style={{ fontSize: 11, color: C.green, marginTop: 4 }}>✓ Áudio carregado</div>
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6 }}>COLE A LETRA DA CANTIGA</div>
              <textarea value={lyrics} onChange={e => setLyrics(e.target.value)} placeholder="Cole aqui a letra da sua cantiga para que o Claude possa criar o roteiro visual..." rows={10} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }} />
            </div>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da cantiga..." style={{ ...inputStyle, maxWidth: 300 }} />
            <button onClick={() => { if (lyrics.trim() && musicUrl) { setStep(3); generateStoryboard() } else { setError('Suba o áudio e cole a letra.') } }} disabled={!lyrics.trim() || !musicUrl} style={{ ...btnPrimary, alignSelf: 'flex-start', opacity: lyrics.trim() && musicUrl ? 1 : 0.4 }}>Gerar Roteiro Visual →</button>
          </div>
        )}

        {/* MODO CRIAR — PASSO 1: Ideia + Letra */}
        {mode === 'create' && step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6 }}>IDEIA DA CANTIGA</div>
            <textarea value={idea} onChange={e => setIdea(e.target.value)} placeholder="Ex: Uma cantiga sobre compartilhar o lanche com os amigos na escola..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6 }}>TEMA</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {THEMES.map(t => (
                  <button key={t} onClick={() => setTheme(t)} style={{ background: theme === t ? `${C.gold}20` : C.card, border: `1px solid ${theme === t ? C.gold : C.border}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, color: theme === t ? C.gold : C.textDim, cursor: 'pointer', fontFamily: 'inherit' }}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6 }}>PERSONAGENS</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {CHARS.map(c => (
                  <button key={c.id} onClick={() => setCharacters(prev => prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id])} style={{ background: characters.includes(c.id) ? `${C.purple}20` : C.card, border: `1px solid ${characters.includes(c.id) ? C.purple : C.border}`, borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', color: characters.includes(c.id) ? C.purple : C.textDim }}>{c.emoji} {c.name}</button>
                ))}
              </div>
            </div>
          </div>
          {/* Controles de composição */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6 }}>TEMPO DA MÚSICA</div>
              <select value={musicDuration} onChange={e => setMusicDuration(e.target.value)} style={{ ...inputStyle, width: 120 }}>
                <option value="0:45">~45 segundos</option>
                <option value="1:00">~1 minuto</option>
                <option value="1:30">~1min30</option>
                <option value="2:00">~2 minutos</option>
                <option value="2:30">~2min30</option>
                <option value="3:00">~3 minutos</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6 }}>REFRÃO (quantas vezes)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 3].map(n => (
                  <button key={n} onClick={() => setRefraoCount(n)} style={{ width: 36, height: 36, borderRadius: 8, background: refraoCount >= n ? `${C.gold}30` : C.card, border: `1px solid ${refraoCount >= n ? C.gold : C.border}`, color: refraoCount >= n ? C.gold : C.textDim, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{n}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6 }}>RIMA</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: C.text }}>
                <input type="checkbox" checked={useRhyme} onChange={e => setUseRhyme(e.target.checked)} style={{ accentColor: C.gold, width: 16, height: 16 }} />
                Com rima
              </label>
            </div>
          </div>

          <button onClick={generateLyrics} disabled={lyricsLoading || !idea.trim()} style={{ ...btnPrimary, alignSelf: 'flex-start', opacity: lyricsLoading ? 0.6 : 1 }}>{lyricsLoading ? 'Gerando letra...' : '✨ Gerar Letra com IA'}</button>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6 }}>LETRA {lyrics ? '(edite se quiser)' : '(ou escreva a sua)'}</div>
            <textarea value={lyrics} onChange={e => setLyrics(e.target.value)} placeholder="A letra aparecerá aqui após a geração, ou escreva a sua..." rows={12} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da cantiga..." style={{ ...inputStyle, maxWidth: 300 }} />
            <button onClick={() => { if (lyrics.trim()) { autoSave({ status: 'music', step: 2 }); setStep(2) } }} disabled={!lyrics.trim()} style={{ ...btnPrimary, opacity: lyrics.trim() ? 1 : 0.4 }}>Próximo: Música →</button>
          </div>
        </div>
      )}

      {/* PASSO 2: Música */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: C.card, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{title || 'Cantiga'}</div>
            <div style={{ fontSize: 11, color: C.textDim, whiteSpace: 'pre-wrap', maxHeight: 150, overflowY: 'auto', lineHeight: 1.5 }}>{lyrics}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6 }}>ESTILO MUSICAL</div>
            <input value={style} onChange={e => setStyle(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ background: C.card, borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: C.textDim }}>Custo por geração</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: C.green, fontFamily: 'monospace' }}>{fmt(clientPrices['suno-v4'] ?? 0.11)}</span>
          </div>
          <button onClick={generateMusic} disabled={musicLoading} style={{ ...btnPrimary, alignSelf: 'flex-start', opacity: musicLoading ? 0.6 : 1 }}>{musicLoading ? '🎵 Gerando música...' : '🎵 Gerar Música'}</button>

          {musicUrl && (
            <div style={{ background: C.surface, border: `1px solid ${C.green}40`, borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 8 }}>✓ Música gerada!</div>
              <audio controls src={musicUrl} style={{ width: '100%' }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <a href={musicUrl} download={`${title || 'cantiga'}.mp3`} style={{ ...btnSecondary, textDecoration: 'none', textAlign: 'center' }}>⬇ Download</a>
                <button onClick={generateMusic} style={btnSecondary}>↺ Regenerar</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep(1)} style={btnSecondary}>← Voltar</button>
            <button onClick={() => { autoSave({ status: 'storyboard', step: 3 }); setStep(3); if (!storyboard.length) generateStoryboard() }} disabled={!musicUrl} style={{ ...btnPrimary, opacity: musicUrl ? 1 : 0.4 }}>Próximo: Roteiro Visual →</button>
          </div>
        </div>
      )}

      {/* PASSO 3: Roteiro Visual */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {storyboardLoading ? (
            <div style={{ background: C.surface, border: `1px solid ${C.gold}40`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>✨</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>Claude está criando o roteiro visual...</div>
              <div style={{ fontSize: 12, color: C.textDim }}>Dividindo a letra em cenas com prompts otimizados para o Seedance. Aguarde.</div>
            </div>
          ) : storyboard.length > 0 ? (<>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Roteiro Visual — {storyboard.length} cenas</div>
              <div style={{ fontSize: 11, color: C.textDim }}>Edite as ações livremente. Os prompts serão gerados a partir do seu texto.</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {storyboard.map((s, i) => (
                <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>Cena {s.cena} · {s.duracao}s</span>
                    <span style={{ fontSize: 11, color: C.textDim }}>{s.personagens?.join(', ')}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.purple, fontStyle: 'italic', marginBottom: 6 }}>"{s.trecho}"</div>
                  <textarea
                    value={s.acao}
                    onChange={e => setStoryboard(prev => prev.map((x, j) => j === i ? { ...x, acao: e.target.value } : x))}
                    rows={3}
                    style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: 8, color: C.text, fontSize: 12, fontFamily: 'inherit', outline: 'none', width: '100%', resize: 'vertical', lineHeight: 1.5 }}
                  />
                  {s.prompt_en && (
                    <div style={{ fontSize: 10, color: C.green, fontFamily: 'monospace', background: C.surface, padding: 8, borderRadius: 6, marginTop: 6, border: `1px solid ${C.green}30` }}>✓ Prompt: {s.prompt_en.slice(0, 150)}...</div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep(2)} style={btnSecondary}>← Voltar</button>
              {storyboard.some(s => !s.prompt_en) ? (
                <button onClick={async () => {
                  setStoryboardLoading(true); setError('')
                  try {
                    const updated = [...storyboard]
                    for (let i = 0; i < updated.length; i++) {
                      const s = updated[i]
                      const r = await fetch('/api/lyrics-director', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mode: 'generate_prompt', prompt: `Cena ${s.cena}: ${s.acao}\nCenário: ${s.cenario}\nPersonagens: ${s.personagens?.join(', ')}` }),
                      })
                      if (r.ok) {
                        const d = await r.json()
                        updated[i] = { ...s, prompt_en: d.result?.trim() ?? '' }
                      }
                    }
                    setStoryboard(updated)
                  } catch { setError('Erro ao gerar prompts') }
                  finally { setStoryboardLoading(false) }
                }} disabled={storyboardLoading} style={{ ...btnPrimary, opacity: storyboardLoading ? 0.6 : 1 }}>{storyboardLoading ? 'Gerando prompts...' : '✨ Aprovar e Gerar Prompts'}</button>
              ) : (
                <button onClick={() => { autoSave({ status: 'assets', step: 3 }); setAssetsPhase(true); setCurrentAssetIdx(0) }} style={btnPrimary}>Próximo: Preparar Assets →</button>
              )}
            </div>
          </>) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', padding: 20 }}>
              <div style={{ fontSize: 13, color: C.textDim }}>O roteiro visual ainda não foi gerado.</div>
              <button onClick={generateStoryboard} style={btnPrimary}>✨ Gerar Roteiro Visual</button>
              <button onClick={() => setStep(2)} style={btnSecondary}>← Voltar</button>
            </div>
          )}
        </div>
      )}

      {/* PASSO 3.5: Preparação de Assets */}
      {step === 3 && assetsPhase && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Preparação de Assets · {pendingAssets.length} pendente(s)</div>
            <div style={{ fontSize: 11, color: C.textDim }}>{assetStatus.filter(a => a.ready).length}/{assetStatus.length} prontos</div>
          </div>

          {/* Barra de progresso */}
          <div style={{ height: 6, background: C.card, borderRadius: 3 }}>
            <div style={{ height: '100%', width: `${assetStatus.length > 0 ? (assetStatus.filter(a => a.ready).length / assetStatus.length) * 100 : 0}%`, background: C.green, borderRadius: 3, transition: 'width 0.3s' }} />
          </div>

          {allAssetsReady ? (
            <div style={{ background: `${C.green}10`, border: `1px solid ${C.green}30`, borderRadius: 12, padding: 18, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.green, marginBottom: 6 }}>✓ Todos os assets estão prontos!</div>
              <button onClick={() => { setAssetsPhase(false); autoSave({ status: 'producing', step: 4 }); setStep(4) }} style={btnPrimary}>Ir para Produção →</button>
            </div>
          ) : (
            <>
              {/* Asset atual */}
              {currentAssetIdx < pendingAssets.length && (() => {
                const asset = pendingAssets[currentAssetIdx]
                const icon = asset.type === 'personagem' ? '🧑' : asset.type === 'cenario' ? '🏞' : '📦'
                const typeLabel = asset.type === 'personagem' ? 'Character Sheet' : asset.type === 'cenario' ? 'Cenário' : 'Prop/Item'
                return (
                  <div style={{ background: C.surface, border: `1px solid ${C.gold}40`, borderRadius: 12, padding: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.gold, letterSpacing: '0.5px', marginBottom: 4 }}>ASSET {currentAssetIdx + 1} DE {pendingAssets.length}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>{icon} {asset.nome}</div>
                    <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>Tipo: {typeLabel} · Usado na(s) cena(s): {asset.cenas.join(', ')}</div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {asset.type === 'personagem' ? (
                        <button onClick={() => {
                          setReadyAssetIds(prev => new Set(Array.from(prev).concat(`${asset.type}_${asset.id}`)))
                          setCurrentAssetIdx(prev => prev + 1)
                          // TODO: abrir Character Sheet wizard com descrição pré-preenchida
                        }} style={btnPrimary}>Criar Character Sheet →</button>
                      ) : (
                        <button onClick={() => {
                          // Marca como pronto e avança
                          // O creator vai ao Atelier criar manualmente
                          setCurrentAssetIdx(prev => prev + 1)
                        }} style={{ ...btnPrimary, background: C.purple }}>Criar no Atelier →</button>
                      )}
                      <button onClick={() => setCurrentAssetIdx(prev => prev + 1)} style={btnSecondary}>Pular</button>
                      <button onClick={() => {
                        setReadyAssetIds(prev => new Set(Array.from(prev).concat(`${asset.type}_${asset.id}`)))
                        setCurrentAssetIdx(prev => prev + 1)
                      }} style={btnSecondary}>Já tenho este asset ✓</button>
                    </div>
                  </div>
                )
              })()}

              {/* Fila de assets */}
              <div style={{ background: C.card, borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 8, letterSpacing: '0.5px' }}>FILA DE ASSETS</div>
                {assetStatus.map((a, i) => {
                  const isPending = !a.ready
                  const isCurrent = isPending && pendingAssets.indexOf(a as typeof pendingAssets[0]) === currentAssetIdx
                  const icon = a.type === 'personagem' ? '🧑' : a.type === 'cenario' ? '🏞' : '📦'
                  return (
                    <div key={`${a.type}_${a.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: `1px solid ${C.border}80`, fontSize: 12 }}>
                      <span style={{ color: a.ready ? C.green : isCurrent ? C.gold : C.textDim }}>{a.ready ? '✓' : isCurrent ? '→' : '○'}</span>
                      <span>{icon}</span>
                      <span style={{ color: isCurrent ? C.text : C.textDim, fontWeight: isCurrent ? 600 : 400 }}>{a.nome}</span>
                      <span style={{ fontSize: 10, color: C.textDim, marginLeft: 'auto' }}>Cena {a.cenas.join(', ')}</span>
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setAssetsPhase(false) }} style={btnSecondary}>← Voltar ao roteiro</button>
                <button onClick={() => { setAssetsPhase(false); autoSave({ status: 'producing', step: 4 }); setStep(4) }} style={btnSecondary}>Pular preparação →</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* PASSO 4: Produção */}
      {step === 4 && (() => {
        const scenesReady = storyboard.filter(s => s.videoUrl).length
        const allReady = scenesReady === storyboard.length && storyboard.length > 0
        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Produção · {scenesReady}/{storyboard.length} cenas</div>
            <div style={{ height: 6, width: 120, background: C.card, borderRadius: 3 }}>
              <div style={{ height: '100%', width: `${storyboard.length > 0 ? (scenesReady / storyboard.length) * 100 : 0}%`, background: C.green, borderRadius: 3 }} />
            </div>
          </div>

          {allReady && (
            <div style={{ background: `${C.green}10`, border: `1px solid ${C.green}30`, borderRadius: 12, padding: 18, textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>🎉</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.green, marginBottom: 6 }}>Cantiga completa!</div>
              <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>{title} · {storyboard.length} cenas · Na edição final, sobreponha a cantiga do Suno ao vídeo.</div>
              {musicUrl && <div style={{ marginBottom: 8 }}><audio controls src={musicUrl} style={{ width: '100%', maxWidth: 400 }} /></div>}
              <button onClick={() => { autoSave({ status: 'completed' }); setMode(null); loadMinhasCantigas() }} style={btnPrimary}>✓ Finalizar cantiga</button>
            </div>
          )}

          {!allReady && (
            <div style={{ background: C.card, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
                Clique <strong>"Gerar esta cena →"</strong> para ir ao Estúdio com tudo preenchido.<br />
                Na edição final, sobreponha a cantiga ao vídeo montado.
              </div>
            </div>
          )}

          {musicUrl && !allReady && (
            <div style={{ background: C.surface, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, marginBottom: 4 }}>Cantiga (para edição final)</div>
              <audio controls src={musicUrl} style={{ width: '100%' }} />
            </div>
          )}

          {storyboard.map((s, i) => (
            <div key={i} style={{ background: C.card, border: `1px solid ${s.videoUrl ? C.green + '60' : C.border}`, borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: s.videoUrl ? C.green : C.textDim }}>{s.videoUrl ? '✓' : '○'}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>Cena {s.cena}</span>
                  <span style={{ fontSize: 11, color: C.textDim }}>{s.duracao}s</span>
                </div>
                {s.videoUrl ? (
                  <a href={s.videoUrl} download style={{ fontSize: 11, color: C.blue, textDecoration: 'none' }}>⬇ Download</a>
                ) : onGoToStudio ? (
                  <button onClick={() => onGoToStudio(s.prompt_en, musicUrl, s.duracao, s.personagens ?? [])} style={{ background: C.purple, border: 'none', borderRadius: 6, padding: '6px 14px', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Gerar esta cena →</button>
                ) : null}
              </div>
              {s.videoUrl && (
                <video src={s.videoUrl} controls muted playsInline preload="metadata" style={{ width: '100%', maxWidth: 320, borderRadius: 8, marginBottom: 6 }} />
              )}
              <div style={{ fontSize: 11, color: C.purple, fontStyle: 'italic' }}>"{s.trecho}"</div>
              <div style={{ fontSize: 10, color: C.textDim, display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                {s.personagens?.map(p => <span key={p} style={{ background: `${C.purple}15`, borderRadius: 3, padding: '1px 5px' }}>@{p}</span>)}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setAssetsPhase(true); setStep(3) }} style={btnSecondary}>← Voltar aos assets</button>
            <button onClick={() => { setMode(null); loadMinhasCantigas() }} style={btnSecondary}>Salvar e sair</button>
          </div>
        </div>
        )
      })()}
      </>)}
    </div>
  )
}

/* ══════════ CHARACTER SHEET WIZARD ══════════ */
function CharacterSheetWizard({ onClose, onSaved, clientPrices, showBrl, brlRate }: {
  onClose: () => void
  onSaved: () => void
  clientPrices: Record<string, number>
  showBrl?: boolean
  brlRate?: number | null
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [refImage, setRefImage] = useState<string | null>(null)
  const [engineId, setEngineId] = useState('nano-banana-pro')
  const [includeAazStyle, setIncludeAazStyle] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [views, setViews] = useState<{ label: string; url: string; selected: boolean; regenerating: boolean }[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const VIEW_LABELS = ['Frontal', '¾ Direita', 'Perfil', '¾ Esquerda', 'Costas', 'Close Rosto']

  const aazStyle = 'Clay texture 3D animation style, smooth clay surface on skin and clothes, handcrafted slightly rough finish, large expressive eyes with clay sheen, rounded proportions with soft edges, warm palette.'

  const buildPrompt = (viewLabel: string) => {
    const style = includeAazStyle ? aazStyle : ''
    const refNote = refImage ? 'Based on the uploaded reference image. ' : ''
    return `${refNote}${style} ${description.trim()}. ${viewLabel} view, character design reference, white background, consistent even lighting, orthographic camera, full body visible.`.trim()
  }

  const generateAll = async () => {
    if (!description.trim()) { setError('Descreva o personagem.'); return }
    setGenerating(true); setError(''); setViews([])

    const newViews: typeof views = VIEW_LABELS.map(l => ({ label: l, url: '', selected: true, regenerating: false }))
    setViews(newViews)

    // Gera as 6 vistas em paralelo (2 por vez para não sobrecarregar)
    for (let i = 0; i < VIEW_LABELS.length; i += 2) {
      const batch = VIEW_LABELS.slice(i, i + 2)
      const results = await Promise.all(batch.map(async (label) => {
        try {
          const body: Record<string, unknown> = {
            engineId,
            prompt: buildPrompt(label),
            variations: 1,
          }
          if (refImage) body.reference_image = refImage
          const res = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!res.ok) { const d = await res.json().catch(() => ({})); return { label, url: '', error: d.error ?? 'Erro' } }
          const data = await res.json()
          return { label, url: data.imageUrls?.[0] ?? '', error: '' }
        } catch { return { label, url: '', error: 'Erro de rede' } }
      }))

      setViews(prev => prev.map(v => {
        const r = results.find(x => x.label === v.label)
        return r ? { ...v, url: r.url, selected: !!r.url } : v
      }))
    }
    setGenerating(false)
    setStep(2)
  }

  const regenerateView = async (index: number) => {
    setViews(prev => prev.map((v, i) => i === index ? { ...v, regenerating: true } : v))
    try {
      const label = VIEW_LABELS[index]
      const body: Record<string, unknown> = { engineId, prompt: buildPrompt(label), variations: 1 }
      if (refImage) body.reference_image = refImage
      const res = await fetch('/api/generate-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) {
        const data = await res.json()
        const url = data.imageUrls?.[0] ?? ''
        setViews(prev => prev.map((v, i) => i === index ? { ...v, url, selected: !!url, regenerating: false } : v))
      } else { setViews(prev => prev.map((v, i) => i === index ? { ...v, regenerating: false } : v)) }
    } catch { setViews(prev => prev.map((v, i) => i === index ? { ...v, regenerating: false } : v)) }
  }

  const saveSheet = async () => {
    const selectedViews = views.filter(v => v.selected && v.url)
    if (selectedViews.length === 0) { setError('Selecione pelo menos 1 vista.'); return }
    if (!name.trim()) { setError('Dê um nome ao personagem.'); return }
    setSaving(true)
    try {
      const charId = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
      const entry = {
        charId,
        name: name.trim(),
        emoji: '🧑',
        images: selectedViews.map(v => v.url),
        createdAt: new Date().toISOString(),
      }
      await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) })
      onSaved()
      onClose()
    } catch { setError('Erro ao salvar.') }
    finally { setSaving(false) }
  }

  const handleRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setRefImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  const pricePerImg = clientPrices[engineId] ?? 0.04
  const totalCost = 6 * pricePerImg
  const fmt = (v: number) => showBrl && brlRate ? `R$${(v * brlRate).toFixed(2)}` : `$${v.toFixed(3)}`

  const inputStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none', width: '100%' }
  const btnPrimary = { background: C.purple, border: 'none', borderRadius: 8, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 700 as const, cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 14, width: '100%', maxWidth: 800, maxHeight: '92vh', overflow: 'auto', padding: 28 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, letterSpacing: '0.5px' }}>CHARACTER SHEET GENERATOR</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginTop: 2 }}>
              {step === 1 ? 'Descreva o personagem' : step === 2 ? 'Selecione as vistas' : 'Salvar Character Sheet'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 11, color: C.textDim }}>Passo {step}/3</div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textDim, fontSize: 22, cursor: 'pointer' }}>×</button>
          </div>
        </div>

        {/* PASSO 1: Descrição */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6 }}>NOME DO PERSONAGEM</div>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Maria, Tio Jonas, Princesa Léa..." style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6 }}>DESCRIÇÃO VISUAL</div>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva a aparência: idade, cabelo, pele, olhos, roupa, acessórios..." rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6 }}>IMAGEM DE REFERÊNCIA (opcional)</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="file" accept="image/*" onChange={handleRefUpload} style={{ fontSize: 12, color: C.textDim }} />
                {refImage && <img src={refImage} alt="ref" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.border}` }} />}
              </div>
              <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>Suba um sketch, foto ou referência visual para guiar a geração.</div>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6 }}>ENGINE</div>
                <select value={engineId} onChange={e => setEngineId(e.target.value)} style={inputStyle}>
                  <option value="nano-banana-pro">Nano Banana Pro (rápido)</option>
                  <option value="flux-1-dev">Flux 1 Dev (qualidade)</option>
                  <option value="ideogram-v2">Ideogram V2 (premium)</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6 }}>ESTILO</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.text }}>
                  <input type="checkbox" checked={includeAazStyle} onChange={e => setIncludeAazStyle(e.target.checked)} style={{ accentColor: C.purple }} />
                  Incluir estilo AAZ (clay/massinha)
                </label>
              </div>
            </div>
            <div style={{ background: C.card, borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: C.textDim }}>6 vistas × {fmt(pricePerImg)}/img</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.green, fontFamily: 'monospace' }}>{fmt(totalCost)}</div>
            </div>
            {error && <div style={{ fontSize: 12, color: C.red }}>{error}</div>}
            <button onClick={generateAll} disabled={generating} style={{ ...btnPrimary, opacity: generating ? 0.6 : 1 }}>
              {generating ? 'Gerando 6 vistas...' : 'Gerar Character Sheet'}
            </button>
          </div>
        )}

        {/* PASSO 2: Seleção */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12, color: C.textDim }}>Selecione as vistas que ficaram boas. Clique em ↺ para regenerar uma vista individual.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {views.map((v, i) => (
                <div key={i} style={{ background: C.card, border: `2px solid ${v.selected ? C.purple : C.border}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', opacity: v.url ? 1 : 0.5, transition: 'border-color 0.15s' }}>
                  <div style={{ position: 'relative', paddingTop: '100%', background: C.surface }}>
                    {v.url ? (
                      <img src={v.url} alt={v.label} onClick={() => setViews(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textDim, fontSize: 12 }}>{v.regenerating || generating ? '⟳ Gerando...' : 'Sem imagem'}</div>
                    )}
                  </div>
                  <div style={{ padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: v.selected ? C.purple : C.textDim }}>{v.selected ? '✓ ' : ''}{v.label}</span>
                    <button onClick={(e) => { e.stopPropagation(); regenerateView(i) }} disabled={v.regenerating} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 8px', fontSize: 10, color: C.textDim, cursor: 'pointer', fontFamily: 'inherit' }}>{v.regenerating ? '...' : '↺'}</button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.textDim }}>{views.filter(v => v.selected && v.url).length} vista(s) selecionada(s) de {views.filter(v => v.url).length} gerada(s)</div>
            {error && <div style={{ fontSize: 12, color: C.red }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep(1)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 20px', color: C.textDim, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← Voltar</button>
              <button onClick={() => { if (views.filter(v => v.selected && v.url).length === 0) { setError('Selecione pelo menos 1 vista.'); return }; setStep(3) }} style={btnPrimary}>Próximo →</button>
            </div>
          </div>
        )}

        {/* PASSO 3: Salvar */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {views.filter(v => v.selected && v.url).map((v, i) => (
                <div key={i} style={{ flex: 1, maxWidth: 120 }}>
                  <img src={v.url} alt={v.label} style={{ width: '100%', borderRadius: 8, border: `1px solid ${C.purple}40` }} />
                  <div style={{ fontSize: 10, color: C.textDim, textAlign: 'center', marginTop: 4 }}>{v.label}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 6 }}>NOME DO PERSONAGEM</div>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do personagem..." style={inputStyle} />
            </div>
            <div style={{ fontSize: 11, color: C.textDim }}>
              O Character Sheet será salvo na biblioteca. Ao mencionar @{name.trim().toLowerCase().replace(/\s+/g, '_') || 'nome'} no prompt de vídeo, as vistas serão injetadas automaticamente no Omni Reference.
            </div>
            {error && <div style={{ fontSize: 12, color: C.red }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep(2)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 20px', color: C.textDim, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← Voltar</button>
              <button onClick={saveSheet} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? 'Salvando...' : 'Salvar Character Sheet'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* MoveSceneModal e MoveEpisodeModal extraídos para studio/modals/* (M2-PR7) — ver imports no topo. */
