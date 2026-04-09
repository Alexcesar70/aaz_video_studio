'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

/* ═══════════════════════════════════════════════════════════════
   AAZ COM JESUS · PRODUCTION STUDIO v2 — Next.js Edition
   Chamadas Segmind agora via /api/generate e /api/generate-sheet
   API keys nunca expostas no browser
═══════════════════════════════════════════════════════════════ */

const C = {
  bg: '#080A0F', surface: '#0F1218', card: '#151A24', border: '#1E2535',
  borderHi: '#2A3348', gold: '#C9A84C', goldLight: '#E8C96A', goldDim: '#6A5828',
  goldGlow: '#C9A84C30', blue: '#3A7BD5', blueGlow: '#3A7BD520',
  green: '#2ECC71', greenGlow: '#2ECC7120', red: '#E74C3C', purple: '#9B59B6',
  purpleGlow: '#9B59B620', text: '#DCE1EE', textDim: '#8A93A8',
}

const CHARACTERS = [
  { id: 'abraao', name: 'Abraão', emoji: '👴', color: '#C9A84C' },
  { id: 'abigail', name: 'Abigail', emoji: '👧', color: '#D4A0C8' },
  { id: 'zaqueu', name: 'Zaqueu', emoji: '🧔', color: '#7AB8D4' },
  { id: 'tuba', name: 'Tuba', emoji: '🐕', color: '#C8A07A' },
  { id: 'theos', name: 'Theos', emoji: '✨', color: '#A8D4FF' },
  { id: 'miriam', name: 'Miriã', emoji: '👩', color: '#D4C0A0' },
  { id: 'elias', name: 'Elias', emoji: '🧙', color: '#A0D4B0' },
]

const MODES = [
  { id: 'text_to_video', label: 'Texto → Vídeo', icon: '✍', desc: 'Geração por prompt puro' },
  { id: 'first_last_frames', label: 'First/Last Frame', icon: '⇄', desc: 'Controle de início e fim' },
  { id: 'omni_reference', label: 'Omni Reference', icon: '⊞', desc: '9 imgs + 3 vids + 3 áudios' },
]

const RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9']
const DURATIONS = [4, 5, 8, 10, 12, 15]
const COST_PER_SEC = parseFloat(process.env.NEXT_PUBLIC_COST_PER_SEC || '0.19')

/* ── Storage — biblioteca de sheets compartilhada via Vercel KV ── */

/* ── Types ── */
interface Character { id: string; name: string; emoji: string; color: string }
interface RefItem { url: string; label: string; name: string; fromLib?: boolean; charId?: string }
interface LibraryEntry { charId: string; name: string; emoji: string; sheetUrl: string; photos: number; createdAt: string }
interface HistoryItem { id: number; prompt: string; chars: string; mode: string; ratio: string; duration: number; cost: string; url: string; timestamp: string }

/* ── Atoms ── */
const Pill = ({ children, color = C.gold, style = {} }: { children: React.ReactNode; color?: string; style?: React.CSSProperties }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${color}20`, color, border: `1px solid ${color}40`, letterSpacing: '0.5px', whiteSpace: 'nowrap', ...style }}>{children}</span>
)

const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 10, fontWeight: 700, color: C.gold, letterSpacing: '2.5px', textTransform: 'uppercase', fontFamily: "'Georgia',serif", marginBottom: 8 }}>{children}</div>
)

const Divider = () => <div style={{ borderTop: `1px solid ${C.border}`, margin: '6px 0' }} />

const Input = ({ style = {}, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', color: C.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', ...style }} {...props} />
)

export function AAZStudio() {
  const router = useRouter()

  /* tabs */
  const [tab, setTab] = useState('studio')

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

  /* sheet builder */
  const [sheetChar, setSheetChar] = useState<Character | null>(null)
  const [sheetPhotos, setSheetPhotos] = useState<{ url: string; name: string }[]>([])
  const [sheetStatus, setSheetStatus] = useState('idle')
  const [sheetMsg, setSheetMsg] = useState('')

  /* scene director */
  const [sdDesc, setSdDesc] = useState('')
  const [sdChars, setSdChars] = useState<string[]>([])
  const [sdSetting, setSdSetting] = useState('')
  const [sdEmotion, setSdEmotion] = useState('')
  const [sdStatus, setSdStatus] = useState('idle')
  const [sdMsg, setSdMsg] = useState('')

  const toggleSdChar = (id: string) => setSdChars(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const runSceneDirector = async () => {
    if (!sdDesc.trim()) { setSdStatus('error'); setSdMsg('Descreva a cena.'); return }
    setSdStatus('generating'); setSdMsg('Claude está escrevendo os prompts...')
    try {
      const res = await fetch('/api/scene-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene_description: sdDesc,
          characters: sdChars.length ? sdChars : undefined,
          setting: sdSetting || undefined,
          duration,
          emotion: sdEmotion || undefined,
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || `Erro ${res.status}`) }
      const data = await res.json()
      const p = data.prompts as { lang: string; prompt: string }[]
      setPrompts({
        pt: p.find(x => x.lang === 'pt-br')?.prompt ?? '',
        es: p.find(x => x.lang === 'es')?.prompt ?? '',
        en: p.find(x => x.lang === 'en')?.prompt ?? '',
      })
      setSdStatus('success'); setSdMsg('Prompts gerados e injetados nas 3 abas!')
      setTab('studio')
    } catch (err: unknown) {
      setSdStatus('error'); setSdMsg(err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }

  /* studio */
  const [selChars, setSelChars] = useState<Character[]>([])
  const [mode, setMode] = useState('text_to_video')
  const [ratio, setRatio] = useState('16:9')
  const [duration, setDuration] = useState(5)
  const [lang, setLang] = useState<'pt' | 'es' | 'en'>('pt')
  const [prompts, setPrompts] = useState<Record<'pt' | 'es' | 'en', string>>({ pt: '', es: '', en: '' })

  /* refs omni */
  const [refImgs, setRefImgs] = useState<RefItem[]>([])
  const [refVids, setRefVids] = useState<RefItem[]>([])
  const [refAuds, setRefAuds] = useState<RefItem[]>([])

  /* first/last */
  const [firstUrl, setFirstUrl] = useState('')
  const [lastUrl, setLastUrl] = useState('')

  /* chain */
  const [chain, setChain] = useState(false)
  const [lastResult, setLastResult] = useState('')

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

  const cost = (duration * COST_PER_SEC).toFixed(2)
  const totalCost = history.reduce((s, h) => s + parseFloat(h.cost), 0).toFixed(2)

  /* ── helpers ── */
  const toggleChar = (c: Character) => setSelChars(p => p.find(x => x.id === c.id) ? p.filter(x => x.id !== c.id) : [...p, c])

  const toDataUrl = (file: File): Promise<string> => new Promise(res => {
    const r = new FileReader(); r.onload = e => res(e.target?.result as string); r.readAsDataURL(file)
  })

  const addRef = async (e: React.ChangeEvent<HTMLInputElement>, type: string, list: RefItem[], setter: React.Dispatch<React.SetStateAction<RefItem[]>>, max: number) => {
    const files = Array.from(e.target.files || [])
    for (const f of files) {
      if (list.length >= max) break
      const url = await toDataUrl(f)
      const idx = list.length + 1
      setter(p => [...p, { url, label: `@${type}${idx}`, name: f.name }])
    }
  }

  const addSheetPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3 - sheetPhotos.length)
    for (const f of files) { const url = await toDataUrl(f); setSheetPhotos(p => [...p, { url, name: f.name }]) }
  }

  const addFromLibrary = (charId: string) => {
    const entry = library[charId]
    if (!entry || refImgs.length >= 9) return
    const idx = refImgs.length + 1
    setRefImgs(p => [...p, { url: entry.sheetUrl, label: `@image${idx}`, name: `Sheet · ${entry.name}`, fromLib: true, charId }])
  }

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

  /* ── Generate Sheet — via /api/generate-sheet (sem CORS) ── */
  const genSheet = async () => {
    if (!sheetChar) { setSheetStatus('error'); setSheetMsg('Selecione um personagem.'); return }
    if (!sheetPhotos.length) { setSheetStatus('error'); setSheetMsg('Adicione ao menos 1 foto.'); return }
    setSheetStatus('generating'); setSheetMsg('Gerando character sheet 4K...')
    try {
      const res = await fetch('/api/generate-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference_images: sheetPhotos.map(p => p.url),
          character_name: sheetChar.name,
          character_id: sheetChar.id,
        }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || `Erro ${res.status}`) }
      const blob = await res.blob()
      const sheetUrl = await new Promise<string>(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
      const entry: LibraryEntry = {
        charId: sheetChar.id, name: sheetChar.name, emoji: sheetChar.emoji,
        sheetUrl, photos: sheetPhotos.length, createdAt: new Date().toLocaleDateString('pt-BR'),
      }
      setLibrary(prev => ({ ...prev, [sheetChar.id]: entry }))
      await saveToKV(entry)
      setSheetStatus('success'); setSheetMsg(`Sheet de ${sheetChar.name} salvo!`)
      setSheetPhotos([]); setSheetChar(null)
    } catch (err: unknown) {
      setSheetStatus('error'); setSheetMsg(err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }

  /* ── Generate Video — via /api/generate (sem CORS) ── */
  const generate = async () => {
    if (!prompts[lang].trim()) { setStatus('error'); setStatusMsg('Escreva o prompt.'); return }
    setGenerating(true); setStatus('generating'); setStatusMsg('Enviando para Seedance 2.0...'); setResultUrl('')

    const body: Record<string, unknown> = {
      prompt: prompts[lang],
      duration,
      aspect_ratio: ratio,
      resolution: '720p',
      generate_audio: false,
      mode,
    }

    if (mode === 'first_last_frames') {
      if (firstUrl) body.first_frame_url = firstUrl
      if (lastUrl) body.last_frame_url = lastUrl
    }
    if (mode === 'omni_reference') {
      if (refImgs.length) body.reference_images = refImgs.map(r => r.url)
      if (refVids.length) body.reference_videos = refVids.map(r => r.url)
      if (refAuds.length) body.reference_audios = refAuds.map(r => r.url)
    }
    if (chain && lastResult) body.first_frame_url = lastResult

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || `Erro ${res.status}`) }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setResultUrl(url); setLastResult(url); setStatus('success'); setStatusMsg('Vídeo gerado!')
      setHistory(p => [{
        id: Date.now(),
        prompt: prompts[lang].slice(0, 90) + (prompts[lang].length > 90 ? '…' : ''),
        chars: selChars.map(c => c.name).join(', '),
        mode, ratio, duration, cost, url,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
      }, ...p.slice(0, 19)])
    } catch (err: unknown) {
      setStatus('error'); setStatusMsg(err instanceof Error ? err.message : 'Erro Segmind.')
    } finally {
      setGenerating(false)
    }
  }

  const statusColor = status === 'success' ? C.green : status === 'error' ? C.red : C.gold

  /* ─────────────────────────── RENDER ─────────────────────────── */
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,serif", fontSize: 13 }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(180deg,${C.surface},${C.bg})`, borderBottom: `1px solid ${C.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, background: `linear-gradient(135deg,${C.gold},${C.goldDim})`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: `0 0 18px ${C.goldGlow}` }}>✝</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.gold, letterSpacing: 1, fontFamily: "'Georgia',serif" }}>AAZ com Jesus</div>
            <div style={{ fontSize: 9, color: C.textDim, letterSpacing: 3, textTransform: 'uppercase' }}>Production Studio · Seedance 2.0</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <Pill color={C.green}>● Segmind Fast</Pill>
          <Pill color={C.gold}>${COST_PER_SEC}/seg</Pill>
          <Pill color={C.purple}>{Object.keys(library).length} sheets</Pill>
          <Pill color={C.textDim}>{history.length} cenas</Pill>
          <button
            onClick={handleLogout}
            style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 7, padding: '4px 10px', cursor: 'pointer', color: C.textDim, fontSize: 10, fontFamily: 'inherit', letterSpacing: '0.5px' }}
          >
            Sair
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.surface, padding: '0 24px' }}>
        {[['studio', '🎬 Estúdio'], ['director', '🎭 Scene Director'], ['library', '📚 Biblioteca'], ['history', '📋 Histórico']].map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)} style={{ background: 'transparent', border: 'none', borderBottom: tab === id ? `2px solid ${C.gold}` : '2px solid transparent', color: tab === id ? C.gold : C.textDim, padding: '11px 18px', cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.8px', fontFamily: 'inherit', transition: 'all 0.15s' }}>{lbl}</button>
        ))}
      </div>

      {/* ══════════ ESTÚDIO ══════════ */}
      {tab === 'studio' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 390px', minHeight: 'calc(100vh - 105px)' }}>

          {/* ── Esquerda ── */}
          <div style={{ padding: '22px 26px', borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>

            <div style={{ background: `${C.blue}10`, border: `1px solid ${C.blue}30`, borderRadius: 9, padding: '10px 14px', fontSize: 11, color: C.blue }}>
              ✓ API keys protegidas server-side — as chamadas ao Segmind passam pelo backend
            </div>

            <Divider />

            {/* Personagens */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Label>Personagens</Label>
                {selChars.length > 0 && <button onClick={injectTags} style={{ background: `${C.gold}20`, border: `1px solid ${C.gold}40`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: C.gold, fontSize: 10, fontWeight: 700, fontFamily: 'inherit' }}>Injetar tags</button>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7 }}>
                {CHARACTERS.map(char => {
                  const sel = selChars.find(c => c.id === char.id)
                  const hasSheet = !!library[char.id]
                  return (
                    <button key={char.id} onClick={() => toggleChar(char)} style={{ background: sel ? `${char.color}18` : C.card, border: `1px solid ${sel ? char.color : C.border}`, borderRadius: 9, padding: '9px 5px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, position: 'relative', transition: 'all 0.15s' }}>
                      {hasSheet && <div style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, background: C.green, borderRadius: '50%' }} />}
                      <span style={{ fontSize: 20 }}>{char.emoji}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: sel ? char.color : C.textDim }}>{char.name}</span>
                    </button>
                  )
                })}
              </div>
              {selChars.filter(c => library[c.id]).length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {selChars.filter(c => library[c.id]).map(c => (
                    <button key={c.id} onClick={() => { setMode('omni_reference'); addFromLibrary(c.id) }} style={{ background: C.purpleGlow, border: `1px solid ${C.purple}50`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', color: C.purple, fontSize: 10, fontWeight: 700, fontFamily: 'inherit' }}>+ Sheet de {c.name}</button>
                  ))}
                </div>
              )}
            </div>

            <Divider />

            {/* Modo */}
            <div>
              <Label>Modo de Geração</Label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {MODES.map(m => (
                  <button key={m.id} onClick={() => setMode(m.id)} style={{ background: mode === m.id ? `${C.gold}14` : C.card, border: `1px solid ${mode === m.id ? C.gold : C.border}`, borderRadius: 10, padding: '11px 7px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: 16, marginBottom: 4 }}>{m.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: mode === m.id ? C.gold : C.text, marginBottom: 2 }}>{m.label}</div>
                    <div style={{ fontSize: 9, color: C.textDim }}>{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* OMNI REFERENCE */}
            {mode === 'omni_reference' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Label>Imagens ({refImgs.length}/9)</Label>
                    <button disabled={refImgs.length >= 9} onClick={() => imgRef.current?.click()} style={{ background: C.blueGlow, border: `1px solid ${C.blue}50`, borderRadius: 7, padding: '3px 10px', cursor: 'pointer', color: C.blue, fontSize: 10, fontWeight: 700, fontFamily: 'inherit', opacity: refImgs.length >= 9 ? 0.4 : 1 }}>+ Adicionar</button>
                    <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { Array.from(e.target.files || []).forEach(async f => { if (refImgs.length < 9) { const url = await toDataUrl(f); setRefImgs(p => [...p, { url, label: `@image${p.length + 1}`, name: f.name }]) } }) }} />
                  </div>
                  {refImgs.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {refImgs.map((r, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <img src={r.url} alt={r.label} style={{ width: 62, height: 62, borderRadius: 7, objectFit: 'cover', border: `1px solid ${r.fromLib ? C.purple : C.border}` }} />
                          <div style={{ position: 'absolute', top: -5, left: -5, background: r.fromLib ? C.purple : C.gold, color: '#000', borderRadius: 9, fontSize: 8, fontWeight: 800, padding: '1px 4px', fontFamily: 'monospace' }}>{r.label}</div>
                          <button onClick={() => setRefImgs(p => p.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -5, right: -5, background: C.red, color: '#fff', border: 'none', borderRadius: '50%', width: 15, height: 15, cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div onClick={() => imgRef.current?.click()} style={{ border: `1px dashed ${C.border}`, borderRadius: 8, padding: '12px', textAlign: 'center', color: C.textDim, fontSize: 11, cursor: 'pointer' }}>📎 Personagem · Cenário · Estilo</div>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Label>Vídeos de Referência ({refVids.length}/3)</Label>
                    <button disabled={refVids.length >= 3} onClick={() => vidRef.current?.click()} style={{ background: C.blueGlow, border: `1px solid ${C.blue}50`, borderRadius: 7, padding: '3px 10px', cursor: 'pointer', color: C.blue, fontSize: 10, fontWeight: 700, fontFamily: 'inherit', opacity: refVids.length >= 3 ? 0.4 : 1 }}>+ Adicionar</button>
                    <input ref={vidRef} type="file" accept="video/mp4,video/mov" multiple style={{ display: 'none' }} onChange={e => addRef(e, 'video', refVids, setRefVids, 3)} />
                  </div>
                  {refVids.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      {refVids.map((r, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, background: C.card, border: `1px solid ${C.border}`, borderRadius: 7, padding: '6px 10px' }}>
                          <span style={{ fontSize: 10, fontFamily: 'monospace', color: C.blue }}>{r.label}</span>
                          <span style={{ fontSize: 10, color: C.textDim, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                          <button onClick={() => setRefVids(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12, padding: 0 }}>×</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div onClick={() => vidRef.current?.click()} style={{ border: `1px dashed ${C.border}`, borderRadius: 8, padding: '12px', textAlign: 'center', color: C.textDim, fontSize: 11, cursor: 'pointer' }}>🎥 Movimento de câmera · Estilo de cena</div>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Label>Áudios de Referência ({refAuds.length}/3)</Label>
                    <button disabled={refAuds.length >= 3} onClick={() => audRef.current?.click()} style={{ background: C.blueGlow, border: `1px solid ${C.blue}50`, borderRadius: 7, padding: '3px 10px', cursor: 'pointer', color: C.blue, fontSize: 10, fontWeight: 700, fontFamily: 'inherit', opacity: refAuds.length >= 3 ? 0.4 : 1 }}>+ Adicionar</button>
                    <input ref={audRef} type="file" accept="audio/mp3,audio/wav" multiple style={{ display: 'none' }} onChange={e => addRef(e, 'audio', refAuds, setRefAuds, 3)} />
                  </div>
                  {refAuds.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      {refAuds.map((r, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, background: C.card, border: `1px solid ${C.border}`, borderRadius: 7, padding: '6px 10px' }}>
                          <span style={{ fontSize: 10, fontFamily: 'monospace', color: C.purple }}>{r.label}</span>
                          <span style={{ fontSize: 10, color: C.textDim, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                          <button onClick={() => setRefAuds(p => p.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12, padding: 0 }}>×</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div onClick={() => audRef.current?.click()} style={{ border: `1px dashed ${C.border}`, borderRadius: 8, padding: '12px', textAlign: 'center', color: C.textDim, fontSize: 11, cursor: 'pointer' }}>🎵 Voz · Música · Ambiente (max 15s)</div>
                  )}
                </div>
              </div>
            )}

            {/* First/Last */}
            {mode === 'first_last_frames' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Label>URLs de Frame</Label>
                <Input placeholder="URL do primeiro frame..." value={firstUrl} onChange={e => setFirstUrl(e.target.value)} style={{ fontFamily: 'monospace' }} />
                <Input placeholder="URL do último frame..." value={lastUrl} onChange={e => setLastUrl(e.target.value)} style={{ fontFamily: 'monospace' }} />
              </div>
            )}

            <Divider />

            {/* Formato */}
            <div>
              <Label>Aspect Ratio</Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {RATIOS.map(r => (
                  <button key={r} onClick={() => setRatio(r)} style={{ background: ratio === r ? `${C.blue}20` : C.card, border: `1px solid ${ratio === r ? C.blue : C.border}`, borderRadius: 7, padding: '5px 13px', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: ratio === r ? C.blue : C.textDim, fontFamily: 'monospace', transition: 'all 0.15s' }}>{r}</button>
                ))}
              </div>
            </div>

            <div>
              <Label>Duração</Label>
              <div style={{ display: 'flex', gap: 6 }}>
                {DURATIONS.map(d => (
                  <button key={d} onClick={() => setDuration(d)} style={{ background: duration === d ? `${C.blue}20` : C.card, border: `1px solid ${duration === d ? C.blue : C.border}`, borderRadius: 7, padding: '5px 13px', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: duration === d ? C.blue : C.textDim, fontFamily: 'monospace', transition: 'all 0.15s' }}>{d}s</button>
                ))}
              </div>
            </div>

            {lastResult && (
              <div style={{ background: C.card, border: `1px solid ${C.green}40`, borderRadius: 9, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="chain" checked={chain} onChange={e => setChain(e.target.checked)} style={{ accentColor: C.gold, width: 15, height: 15 }} />
                <label htmlFor="chain" style={{ cursor: 'pointer', fontSize: 12 }}>Encadear do último frame gerado</label>
                <Pill color={C.green}>Disponível</Pill>
              </div>
            )}
          </div>

          {/* ── Direita ── */}
          <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 16, background: C.surface, overflowY: 'auto' }}>
            <div>
              <Label>Prompt da Cena</Label>
              <div style={{ display: 'flex', gap: 4, background: C.card, padding: 3, borderRadius: 9, border: `1px solid ${C.border}`, marginBottom: 10 }}>
                {[['pt', 'PT-BR'], ['es', 'ES'], ['en', 'EN']].map(([l, lbl]) => (
                  <button key={l} onClick={() => setLang(l as 'pt' | 'es' | 'en')} style={{ flex: 1, padding: '6px', borderRadius: 7, background: lang === l ? C.surface : 'transparent', border: lang === l ? `1px solid ${C.border}` : '1px solid transparent', cursor: 'pointer', fontSize: 10, fontWeight: 700, color: lang === l ? C.gold : C.textDim, transition: 'all 0.15s', fontFamily: 'inherit', letterSpacing: '0.5px' }}>{lbl}</button>
                ))}
              </div>
              <textarea
                placeholder={lang === 'pt' ? 'Descreva a cena...' : lang === 'es' ? 'Describe la escena...' : 'Describe the scene...'}
                value={prompts[lang]}
                onChange={e => setPrompts(p => ({ ...p, [lang]: e.target.value }))}
                style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '11px 12px', color: C.text, fontSize: 12, fontFamily: 'inherit', lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box', minHeight: 130 }}
                rows={6}
              />
              {selChars.length > 0 && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 7 }}>
                  {selChars.map(c => <Pill key={c.id} color={c.color}>{c.emoji} {library[c.id] ? '@image' : '@character:' + c.id}</Pill>)}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `${C.green}10`, border: `1px solid ${C.green}30`, borderRadius: 9, padding: '11px 14px' }}>
              <div>
                <div style={{ fontSize: 10, color: C.textDim, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Custo estimado</div>
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{duration}s · Segmind · ${COST_PER_SEC}/s</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.green, fontFamily: 'monospace' }}>${cost}</div>
            </div>

            <button onClick={generate} disabled={generating} style={{ background: generating ? C.card : `linear-gradient(135deg,${C.gold},${C.goldDim})`, border: `1px solid ${generating ? C.border : C.gold}`, borderRadius: 11, padding: '15px', cursor: generating ? 'not-allowed' : 'pointer', color: generating ? C.textDim : '#000', fontSize: 13, fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', width: '100%', fontFamily: "'Georgia',serif", boxShadow: generating ? 'none' : `0 0 22px ${C.goldGlow}`, transition: 'all 0.2s' }}>
              {generating ? '⟳ Gerando...' : '✝ Gerar Cena'}
            </button>

            {status !== 'idle' && (
              <div style={{ textAlign: 'center' }}>
                <Pill color={statusColor}>{status === 'generating' && '⟳ '}{status === 'success' && '✓ '}{status === 'error' && '✕ '}{statusMsg}</Pill>
              </div>
            )}

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 11, overflow: 'hidden', minHeight: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
              {resultUrl
                ? <video src={resultUrl} controls autoPlay loop style={{ width: '100%', borderRadius: 7 }} />
                : <div style={{ textAlign: 'center', color: C.textDim }}><div style={{ fontSize: 34, marginBottom: 7 }}>🎬</div><div style={{ fontSize: 12 }}>O vídeo aparecerá aqui</div></div>
              }
            </div>

            {resultUrl && (
              <a href={resultUrl} download={`aaz-${Date.now()}.mp4`} style={{ display: 'block', textAlign: 'center', padding: '9px', background: C.blueGlow, border: `1px solid ${C.blue}40`, borderRadius: 7, color: C.blue, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>↓ Baixar MP4</a>
            )}
          </div>
        </div>
      )}

      {/* ══════════ SCENE DIRECTOR ══════════ */}
      {tab === 'director' && (
        <div style={{ padding: '26px', maxWidth: 700 }}>
          <Label>🎭 Scene Director — Claude AI</Label>
          <div style={{ background: `${C.purple}10`, border: `1px solid ${C.purple}30`, borderRadius: 9, padding: '10px 14px', fontSize: 11, color: C.purple, marginBottom: 18 }}>
            Descreva a cena em texto livre. O Claude gera prompts otimizados para Seedance 2.0 em PT-BR, ES e EN e injeta automaticamente nas 3 abas do Estúdio.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, letterSpacing: '1px' }}>DESCRIÇÃO DA CENA</div>
              <textarea
                placeholder="Ex: Abraão e Abigail estão no Clube da Aliança. Abraão pega o brinquedo da Abigail sem pedir. Ela fica com o maxilar apertado, olhos marejados. Tuba late baixo, as sobrancelhas caem. Até que Abraão percebe e devolve..."
                value={sdDesc}
                onChange={e => setSdDesc(e.target.value)}
                style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '11px 12px', color: C.text, fontSize: 12, fontFamily: 'inherit', lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box', minHeight: 120 }}
                rows={5}
              />
            </div>

            <div>
              <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, letterSpacing: '1px' }}>PERSONAGENS NA CENA</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                {CHARACTERS.map(char => {
                  const sel = sdChars.includes(char.id)
                  return (
                    <button key={char.id} onClick={() => toggleSdChar(char.id)} style={{ background: sel ? `${char.color}18` : C.card, border: `1px solid ${sel ? char.color : C.border}`, borderRadius: 9, padding: '8px 4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, transition: 'all 0.15s' }}>
                      <span style={{ fontSize: 18 }}>{char.emoji}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: sel ? char.color : C.textDim }}>{char.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, letterSpacing: '1px' }}>CENÁRIO (opcional)</div>
                <Input placeholder="Ex: Clube da Aliança, cozinha..." value={sdSetting} onChange={e => setSdSetting(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, letterSpacing: '1px' }}>CONFLITO EMOCIONAL (opcional)</div>
                <Input placeholder="Ex: egoísmo vs. compartilhar" value={sdEmotion} onChange={e => setSdEmotion(e.target.value)} />
              </div>
            </div>

            <button onClick={runSceneDirector} disabled={sdStatus === 'generating'} style={{ background: sdStatus === 'generating' ? C.card : `linear-gradient(135deg,${C.purple},#6B3FA0)`, border: `1px solid ${sdStatus === 'generating' ? C.border : C.purple}`, borderRadius: 11, padding: '14px', cursor: sdStatus === 'generating' ? 'not-allowed' : 'pointer', color: sdStatus === 'generating' ? C.textDim : '#fff', fontSize: 13, fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', width: '100%', fontFamily: "'Georgia',serif", boxShadow: sdStatus === 'generating' ? 'none' : `0 0 22px ${C.purpleGlow}`, transition: 'all 0.2s' }}>
              {sdStatus === 'generating' ? '⟳ Claude escrevendo...' : '🎭 Gerar Prompts Trilíngues'}
            </button>

            {sdStatus !== 'idle' && (
              <div style={{ textAlign: 'center' }}>
                <Pill color={sdStatus === 'success' ? C.green : sdStatus === 'error' ? C.red : C.purple}>
                  {sdStatus === 'generating' && '⟳ '}{sdStatus === 'success' && '✓ '}{sdStatus === 'error' && '✕ '}{sdMsg}
                </Pill>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ BIBLIOTECA ══════════ */}
      {tab === 'library' && (
        <div style={{ padding: '26px', display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div>
            <Label>Gerar Character Sheet · Seedance 2.0</Label>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 13, padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 10, letterSpacing: '1px' }}>SELECIONAR PERSONAGEM</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                  {CHARACTERS.map(char => (
                    <button key={char.id} onClick={() => setSheetChar(char)} style={{ background: sheetChar?.id === char.id ? `${char.color}20` : C.surface, border: `1px solid ${sheetChar?.id === char.id ? char.color : C.border}`, borderRadius: 8, padding: '8px 4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 18 }}>{char.emoji}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: sheetChar?.id === char.id ? char.color : C.textDim }}>{char.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 10, letterSpacing: '1px' }}>FOTOS DE REFERÊNCIA ({sheetPhotos.length}/3)</div>
                {sheetPhotos.length > 0 && (
                  <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
                    {sheetPhotos.map((p, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={p.url} alt={p.name} style={{ width: 58, height: 58, borderRadius: 6, objectFit: 'cover', border: `1px solid ${C.border}` }} />
                        <button onClick={() => setSheetPhotos(p => p.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -4, right: -4, background: C.red, color: '#fff', border: 'none', borderRadius: '50%', width: 14, height: 14, cursor: 'pointer', fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true; i.onchange = (e) => addSheetPhoto(e as unknown as React.ChangeEvent<HTMLInputElement>); i.click() }} style={{ border: `1px dashed ${C.border}`, borderRadius: 8, padding: '13px', textAlign: 'center', color: C.textDim, fontSize: 11, cursor: 'pointer' }}>
                  📷 Adicionar fotos (1-3)
                </div>
              </div>
              <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={genSheet} disabled={sheetStatus === 'generating'} style={{ background: `linear-gradient(135deg,${C.gold},${C.goldDim})`, border: `1px solid ${C.gold}`, borderRadius: 9, padding: '11px 22px', cursor: 'pointer', color: '#000', fontSize: 12, fontWeight: 800, letterSpacing: '1px', fontFamily: "'Georgia',serif", boxShadow: `0 0 18px ${C.goldGlow}` }}>
                  {sheetStatus === 'generating' ? '⟳ Gerando...' : '✦ Gerar Character Sheet 4K'}
                </button>
                {sheetStatus !== 'idle' && <Pill color={sheetStatus === 'success' ? C.green : sheetStatus === 'error' ? C.red : C.gold}>{sheetMsg}</Pill>}
              </div>
            </div>
          </div>

          <div>
            <Label>Biblioteca de Personagens ({Object.keys(library).length})</Label>
            {Object.keys(library).length === 0
              ? <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 11, padding: '40px', textAlign: 'center', color: C.textDim }}><div style={{ fontSize: 30, marginBottom: 8 }}>📚</div><div>Nenhum sheet ainda. Gere o primeiro acima.</div></div>
              : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 14 }}>
                  {Object.values(library).map(entry => {
                    const char = CHARACTERS.find(c => c.id === entry.charId)
                    return (
                      <div key={entry.charId} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 11, overflow: 'hidden' }}>
                        {entry.sheetUrl && <img src={entry.sheetUrl} alt={entry.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />}
                        <div style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
                            <span style={{ fontSize: 18 }}>{entry.emoji}</span>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: char?.color || C.gold }}>{entry.name}</div>
                              <div style={{ fontSize: 9, color: C.textDim }}>{entry.createdAt}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => { setTab('studio'); setMode('omni_reference'); setTimeout(() => addFromLibrary(entry.charId), 150) }} style={{ flex: 1, background: C.purpleGlow, border: `1px solid ${C.purple}50`, borderRadius: 7, padding: '5px', cursor: 'pointer', color: C.purple, fontSize: 10, fontWeight: 700, fontFamily: 'inherit' }}>Usar</button>
                            <button onClick={() => { const next = { ...library }; delete next[entry.charId]; setLibrary(next); deleteFromKV(entry.charId) }} style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: C.red, fontSize: 11, fontFamily: 'inherit' }}>×</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }
          </div>
        </div>
      )}

      {/* ══════════ HISTÓRICO ══════════ */}
      {tab === 'history' && (
        <div style={{ padding: '26px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Label>Histórico ({history.length} cenas)</Label>
            {history.length > 0 && <button onClick={() => setHistory([])} style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 7, padding: '4px 11px', cursor: 'pointer', color: C.red, fontSize: 10, fontWeight: 700, fontFamily: 'inherit' }}>Limpar</button>}
          </div>
          {history.length > 0 && (
            <div style={{ background: `${C.green}10`, border: `1px solid ${C.green}30`, borderRadius: 9, padding: '11px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 10, color: C.textDim, letterSpacing: '1px', textTransform: 'uppercase' }}>Total gasto nesta sessão</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.green, fontFamily: 'monospace' }}>${totalCost}</div>
            </div>
          )}
          {history.length === 0
            ? <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 11, padding: '48px', textAlign: 'center', color: C.textDim }}><div style={{ fontSize: 38, marginBottom: 8 }}>🎬</div><div>Nenhuma cena ainda.</div></div>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {history.map(item => (
                  <div key={item.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 9, padding: '13px 15px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', gap: 5, marginBottom: 6, flexWrap: 'wrap' }}>
                        <Pill color={C.textDim}>{item.timestamp}</Pill>
                        <Pill color={C.blue}>{item.ratio}</Pill>
                        <Pill color={C.blue}>{item.duration}s</Pill>
                        <Pill color={C.purple}>{item.mode}</Pill>
                        <Pill color={C.green}>${item.cost}</Pill>
                      </div>
                      <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5, marginBottom: 4 }}>{item.prompt}</div>
                      {item.chars && <div style={{ fontSize: 11, color: C.gold }}>{item.chars}</div>}
                    </div>
                    <a href={item.url} download={`aaz-${item.id}.mp4`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, background: C.blueGlow, border: `1px solid ${C.blue}40`, borderRadius: 7, color: C.blue, textDecoration: 'none', fontSize: 16 }}>↓</a>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}
