'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

/* ═══════════════════════════════════════════════════════════════
   AAZ COM JESUS · PRODUCTION STUDIO v2 — Next.js Edition
   Chamadas Segmind agora via /api/generate e /api/generate-sheet
   API keys nunca expostas no browser
═══════════════════════════════════════════════════════════════ */

const C = {
  bg: '#13131a', surface: '#1a1a24', card: '#22222e', border: '#2e2e3e',
  borderHi: '#3a3a4e', gold: '#C9A84C', goldLight: '#E8C96A', goldDim: '#6A5828',
  goldGlow: '#C9A84C30', blue: '#5B8DEF', blueGlow: '#5B8DEF20',
  green: '#4ADE80', greenGlow: '#4ADE8020', red: '#F87171', purple: '#A78BFA',
  purpleGlow: '#A78BFA20', text: '#E8E8F0', textDim: '#9898B0',
}

const CHARACTERS = [
  { id: 'abraao', name: 'Abraão', emoji: '👴', color: '#C9A84C', desc: '8 year old boy, messy orange-red hair, fair skin with freckles, hazel-green eyes, slightly protruding ears, pink vest over teal t-shirt, gray cargo shorts, green-mint canvas sneakers' },
  { id: 'abigail', name: 'Abigail', emoji: '👧', color: '#D4A0C8', desc: '7 year old girl, dark curly hair in two side puffs, warm brown skin, big brown eyes with defined lashes, rosy cheeks, multi-layered dress with colorful geometric print, colorful neck scarf, beaded bracelets, burgundy-pink flats' },
  { id: 'zaqueu', name: 'Zaqueu', emoji: '🧔', color: '#7AB8D4', desc: '9 year old boy, mini-dreads with clay texture, deep dark skin, expressive brown eyes, wide smile, open olive-green jacket with gold buttons over orange t-shirt, geometric colorful shorts, colorful canvas sneakers with orange laces' },
  { id: 'tuba', name: 'Tuba', emoji: '🐕', color: '#C8A07A', desc: 'a cartoon dog, medium sized dog character, four legs, amber-orange fur, cream chest and belly, rounded black nose, expressive dark-brown eyes, floppy ears, curled tail, NOT a human' },
  { id: 'theos', name: 'Theos', emoji: '✨', color: '#A8D4FF', desc: '' },
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
const COST_PER_SEC = parseFloat(process.env.NEXT_PUBLIC_COST_PER_SEC || '0.19')

/* ── Storage — biblioteca de sheets compartilhada via Vercel KV ── */

/* ── Types ── */
interface Character { id: string; name: string; emoji: string; color: string; desc: string }
interface RefItem { url: string; label: string; name: string; fromLib?: boolean; charId?: string }
interface LibraryEntry { charId: string; name: string; emoji: string; sheetUrl: string; photos: number; createdAt: string }
interface ScenarioEntry { id: string; name: string; imageUrl: string; createdAt: string }
interface HistoryItem { id: number; prompt: string; chars: string; mode: string; ratio: string; duration: number; cost: string; url: string; timestamp: string }

/* ── Atoms ── */
const Pill = ({ children, color = C.gold, style = {} }: { children: React.ReactNode; color?: string; style?: React.CSSProperties }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: `${color}18`, color, border: `1px solid ${color}35`, whiteSpace: 'nowrap', ...style }}>{children}</span>
)

const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, letterSpacing: '0.5px', marginBottom: 10 }}>{children}</div>
)

const Divider = () => <div style={{ borderTop: `1px solid ${C.border}`, margin: '10px 0' }} />

const Input = ({ style = {}, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', ...style }} {...props} />
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

  /* scenarios */
  const [scenarios, setScenarios] = useState<ScenarioEntry[]>([])
  const [scenarioName, setScenarioName] = useState('')
  const [scenarioPhoto, setScenarioPhoto] = useState<{ url: string; name: string } | null>(null)

  const addScenarioPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { const url = await toDataUrl(f); setScenarioPhoto({ url, name: f.name }) }
  }

  const saveScenario = () => {
    if (!scenarioName.trim() || !scenarioPhoto) return
    const entry: ScenarioEntry = { id: `scene_${Date.now()}`, name: scenarioName, imageUrl: scenarioPhoto.url, createdAt: new Date().toLocaleDateString('pt-BR') }
    setScenarios(p => [...p, entry])
    setScenarioName(''); setScenarioPhoto(null)
  }

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
        es: '',
        en: p.find(x => x.lang === 'en')?.prompt ?? '',
      })
      setSdStatus('success'); setSdMsg('Prompts gerados e injetados nas abas PT e EN!')
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

  /* first/last — agora com upload de imagem */
  const [firstUrl, setFirstUrl] = useState('')
  const [lastUrl, setLastUrl] = useState('')
  const [firstPreview, setFirstPreview] = useState('')
  const [lastPreview, setLastPreview] = useState('')
  const firstFrameRef = useRef<HTMLInputElement>(null)
  const lastFrameRef = useRef<HTMLInputElement>(null)

  const uploadFrame = async (file: File, setter: (v: string) => void, previewSetter: (v: string) => void) => {
    const url = await toDataUrl(file)
    setter(url)
    previewSetter(url)
  }

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

  /* ── Generate Sheet — via /api/generate-sheet (Neolemon V3) ── */
  const genSheet = async () => {
    if (!sheetChar) { setSheetStatus('error'); setSheetMsg('Selecione um personagem.'); return }
    setSheetStatus('generating'); setSheetMsg('Gerando character sheet (~$0.58)...')
    try {
      const charData = CHARACTERS.find(c => c.id === sheetChar.id)
      const prompt = charData?.desc
        ? `${charData.desc}. Character reference sheet showing multiple poses: front view, side view, back view, 3/4 view. 3D clay texture animation style, rounded proportions, warm palette, clean white background.`
        : `${sheetChar.name} character reference sheet, multiple poses, front view, side view, back view, 3D clay texture style, white background`

      const res = await fetch('/api/generate-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference_images: sheetPhotos.length ? sheetPhotos.map(p => p.url) : undefined,
          character_name: sheetChar.name,
          character_id: sheetChar.id,
          prompt,
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
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", fontSize: 14 }}>

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>AAZ Studio</div>
          <Pill color={C.textDim}>Seedance 2.0</Pill>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Pill color={C.green}>${COST_PER_SEC}/s</Pill>
          <Pill color={C.purple}>{Object.keys(library).length} sheets</Pill>
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
        {[['studio', 'Estúdio'], ['director', 'Assistente de Prompt'], ['library', 'Biblioteca'], ['history', 'Histórico']].map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)} style={{ background: 'transparent', border: 'none', borderBottom: tab === id ? `2px solid ${C.purple}` : '2px solid transparent', color: tab === id ? C.text : C.textDim, padding: '13px 20px', cursor: 'pointer', fontSize: 14, fontWeight: tab === id ? 600 : 400, fontFamily: 'inherit', transition: 'all 0.15s' }}>{lbl}</button>
        ))}
      </div>

      {/* ══════════ ESTÚDIO ══════════ */}
      {tab === 'studio' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', minHeight: 'calc(100vh - 100px)' }}>

          {/* ── Esquerda: Preview grande + Prompt ── */}
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>

            {/* Video Preview — grande */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
              {resultUrl
                ? <video src={resultUrl} controls autoPlay loop style={{ width: '100%', borderRadius: 8 }} />
                : <div style={{ textAlign: 'center', color: C.textDim, padding: 60 }}><div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div><div style={{ fontSize: 16 }}>O vídeo aparecerá aqui</div></div>
              }
            </div>

            {/* Download + Status */}
            {resultUrl && (
              <a href={resultUrl} download={`aaz-${Date.now()}.mp4`} style={{ display: 'block', textAlign: 'center', padding: '12px', background: C.purpleGlow, border: `1px solid ${C.purple}50`, borderRadius: 10, color: C.purple, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>↓ Baixar MP4</a>
            )}

            {status !== 'idle' && (
              <div style={{ textAlign: 'center' }}>
                <Pill color={statusColor}>{status === 'generating' && '⟳ '}{status === 'success' && '✓ '}{status === 'error' && '✕ '}{statusMsg}</Pill>
              </div>
            )}

            {/* Prompt — abaixo do vídeo */}
            <div>
              <Label>Prompt</Label>
              <div style={{ display: 'flex', gap: 4, background: C.card, padding: 4, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 12 }}>
                {[['pt', 'PT-BR'], ['es', 'ES'], ['en', 'EN']].map(([l, lbl]) => (
                  <button key={l} onClick={() => setLang(l as 'pt' | 'es' | 'en')} style={{ flex: 1, padding: '8px', borderRadius: 8, background: lang === l ? C.surface : 'transparent', border: lang === l ? `1px solid ${C.border}` : '1px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: lang === l ? C.text : C.textDim, transition: 'all 0.15s', fontFamily: 'inherit' }}>{lbl}</button>
                ))}
              </div>
              <textarea
                placeholder={lang === 'pt' ? 'Descreva a cena...' : lang === 'es' ? 'Describe la escena...' : 'Describe the scene...'}
                value={prompts[lang]}
                onChange={e => setPrompts(p => ({ ...p, [lang]: e.target.value }))}
                style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px', color: C.text, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box', minHeight: 100 }}
                rows={4}
              />
              {selChars.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {selChars.map(c => <Pill key={c.id} color={c.color}>{c.emoji} {c.name}</Pill>)}
                </div>
              )}
            </div>

            {/* Generate button — grande e visível */}
            <button onClick={generate} disabled={generating} style={{ background: generating ? C.card : C.purple, border: `1px solid ${generating ? C.border : C.purple}`, borderRadius: 12, padding: '16px', cursor: generating ? 'not-allowed' : 'pointer', color: generating ? C.textDim : '#fff', fontSize: 16, fontWeight: 700, width: '100%', fontFamily: 'inherit', transition: 'all 0.2s' }}>
              {generating ? '⟳ Gerando...' : 'Gerar Cena'}
            </button>
          </div>

          {/* ── Direita: Settings ── */}
          <div style={{ padding: '20px', borderLeft: `1px solid ${C.border}`, background: C.surface, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Personagens */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Label>Personagens</Label>
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
                    <button disabled={refImgs.length >= 9} onClick={() => imgRef.current?.click()} style={{ background: C.blueGlow, border: `1px solid ${C.blue}50`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: C.blue, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', opacity: refImgs.length >= 9 ? 0.4 : 1 }}>+ Adicionar</button>
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
                    <div onClick={() => imgRef.current?.click()} style={{ border: `1px dashed ${C.border}`, borderRadius: 10, padding: '16px', textAlign: 'center', color: C.textDim, fontSize: 13, cursor: 'pointer' }}>Personagem, cenário ou estilo</div>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Label>Vídeos ({refVids.length}/3)</Label>
                    <button disabled={refVids.length >= 3} onClick={() => vidRef.current?.click()} style={{ background: C.blueGlow, border: `1px solid ${C.blue}50`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: C.blue, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', opacity: refVids.length >= 3 ? 0.4 : 1 }}>+ Adicionar</button>
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
                    <div onClick={() => vidRef.current?.click()} style={{ border: `1px dashed ${C.border}`, borderRadius: 10, padding: '14px', textAlign: 'center', color: C.textDim, fontSize: 13, cursor: 'pointer' }}>Movimento de câmera ou estilo</div>
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Label>Áudios ({refAuds.length}/3)</Label>
                    <button disabled={refAuds.length >= 3} onClick={() => audRef.current?.click()} style={{ background: C.blueGlow, border: `1px solid ${C.blue}50`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', color: C.blue, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', opacity: refAuds.length >= 3 ? 0.4 : 1 }}>+ Adicionar</button>
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
                    <div onClick={() => audRef.current?.click()} style={{ border: `1px dashed ${C.border}`, borderRadius: 10, padding: '14px', textAlign: 'center', color: C.textDim, fontSize: 13, cursor: 'pointer' }}>Voz, música ou ambiente</div>
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

            {/* Custo */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 13, color: C.textDim }}>{duration}s · ${COST_PER_SEC}/s</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.green, fontFamily: 'monospace' }}>${cost}</div>
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

      {/* ══════════ ASSISTENTE DE PROMPT ══════════ */}
      {tab === 'director' && (
        <div style={{ padding: '26px', maxWidth: 700 }}>
          <Label>✨ Assistente de Prompt — Claude AI</Label>
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
              {sdStatus === 'generating' ? '⟳ Claude escrevendo...' : '✨ Gerar Prompts Trilíngues'}
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
                    <button key={char.id} onClick={() => { setSheetChar(char); setSheetPhotos([]); setSheetStatus('idle'); setSheetMsg('') }} style={{ background: sheetChar?.id === char.id ? `${char.color}20` : C.surface, border: `1px solid ${sheetChar?.id === char.id ? char.color : C.border}`, borderRadius: 8, padding: '8px 4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
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

          {/* ── Personagens salvos ── */}
          <div>
            <Label>Personagens Salvos ({Object.keys(library).length})</Label>
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

          {/* ── Cenários ── */}
          <div>
            <Label>Cenários</Label>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 13, padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, letterSpacing: '1px' }}>NOME DO CENÁRIO</div>
                <Input placeholder="Ex: Clube da Aliança, Cozinha..." value={scenarioName} onChange={e => setScenarioName(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.textDim, marginBottom: 8, letterSpacing: '1px' }}>IMAGEM DE REFERÊNCIA</div>
                {scenarioPhoto ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={scenarioPhoto.url} alt={scenarioPhoto.name} style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.border}` }} />
                    <button onClick={() => setScenarioPhoto(null)} style={{ position: 'absolute', top: -4, right: -4, background: C.red, color: '#fff', border: 'none', borderRadius: '50%', width: 14, height: 14, cursor: 'pointer', fontSize: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  </div>
                ) : (
                  <div onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = (e) => addScenarioPhoto(e as unknown as React.ChangeEvent<HTMLInputElement>); i.click() }} style={{ border: `1px dashed ${C.border}`, borderRadius: 8, padding: '13px', textAlign: 'center', color: C.textDim, fontSize: 11, cursor: 'pointer' }}>
                    📷 Upload imagem
                  </div>
                )}
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <button onClick={saveScenario} disabled={!scenarioName.trim() || !scenarioPhoto} style={{ background: scenarioName.trim() && scenarioPhoto ? `linear-gradient(135deg,${C.blue},#2558A8)` : C.card, border: `1px solid ${scenarioName.trim() && scenarioPhoto ? C.blue : C.border}`, borderRadius: 9, padding: '10px 22px', cursor: scenarioName.trim() && scenarioPhoto ? 'pointer' : 'not-allowed', color: scenarioName.trim() && scenarioPhoto ? '#fff' : C.textDim, fontSize: 12, fontWeight: 800, letterSpacing: '1px', fontFamily: "'Georgia',serif" }}>
                  + Salvar Cenário
                </button>
              </div>
            </div>
            {scenarios.length === 0
              ? <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 11, padding: '30px', textAlign: 'center', color: C.textDim }}><div style={{ fontSize: 24, marginBottom: 6 }}>🏠</div><div style={{ fontSize: 11 }}>Nenhum cenário salvo ainda.</div></div>
              : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 14 }}>
                  {scenarios.map(s => (
                    <div key={s.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 11, overflow: 'hidden' }}>
                      <img src={s.imageUrl} alt={s.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                      <div style={{ padding: '12px' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, marginBottom: 4 }}>{s.name}</div>
                        <div style={{ fontSize: 9, color: C.textDim, marginBottom: 8 }}>{s.createdAt}</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setTab('studio'); setMode('omni_reference'); const idx = refImgs.length + 1; setRefImgs(p => [...p, { url: s.imageUrl, label: `@image${idx}`, name: `Cenário · ${s.name}` }]) }} style={{ flex: 1, background: C.blueGlow, border: `1px solid ${C.blue}50`, borderRadius: 7, padding: '5px', cursor: 'pointer', color: C.blue, fontSize: 10, fontWeight: 700, fontFamily: 'inherit' }}>Usar</button>
                          <button onClick={() => setScenarios(p => p.filter(x => x.id !== s.id))} style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: C.red, fontSize: 11, fontFamily: 'inherit' }}>×</button>
                        </div>
                      </div>
                    </div>
                  ))}
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
