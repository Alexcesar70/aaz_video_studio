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
const COST_PER_SEC = parseFloat(process.env.NEXT_PUBLIC_COST_PER_SEC || '0.19')

/* ── Storage — biblioteca de sheets compartilhada via Vercel KV ── */

/* ── Types ── */
interface Character { id: string; name: string; emoji: string; color: string; desc: string }
interface RefItem { url: string; label: string; name: string; fromLib?: boolean; charId?: string }
interface LibraryEntry { charId: string; name: string; emoji: string; images: string[]; createdAt: string }
interface ScenarioEntry { id: string; name: string; imageUrl: string; createdAt: string }
interface Project { id: string; name: string; createdAt: string }
interface Episode { id: string; name: string; projectId?: string | null; createdAt: string }
interface SceneAsset { id: string; episodeId: string; sceneNumber: number; prompt: string; videoUrl: string; lastFrameUrl: string; characters: string[]; duration: number; cost: string; createdAt: string }
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

  const loadEpisodes = useCallback(async () => {
    try { const r = await fetch('/api/episodes'); if (r.ok) { const eps = await r.json(); setEpisodes(eps); if (eps.length && !currentEpisode) setCurrentEpisode(eps[0]) } } catch {}
  }, [currentEpisode])

  const createEpisode = async () => {
    if (!newEpName.trim()) return
    const ep: Episode = {
      id: `ep_${Date.now()}`,
      name: newEpName,
      projectId: currentProject?.id ?? null,
      createdAt: new Date().toISOString()
    }
    setEpisodes(p => [...p, ep]); setCurrentEpisode(ep); setNewEpName('')
    try { await fetch('/api/episodes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ep) }) } catch {}
  }

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
    try { const r = await fetch('/api/scenes'); if (r.ok) setSceneAssets(await r.json()) } catch {}
  }, [])

  /* load all data */
  useEffect(() => { loadProjects(); loadScenarios(); loadEpisodes(); loadScenes() }, [loadProjects, loadScenarios, loadEpisodes, loadScenes])

  /* Se o episódio selecionado não pertence ao projeto atual, desseleciona */
  useEffect(() => {
    if (currentProject && currentEpisode && currentEpisode.projectId !== currentProject.id) {
      setCurrentEpisode(null)
    }
  }, [currentProject, currentEpisode])

  /* asset panel in studio */
  const [showAssets, setShowAssets] = useState(false)
  const [libTab, setLibTab] = useState<'chars' | 'scenarios' | 'scenes'>('chars')

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
  const [lang, setLang] = useState<'pt' | 'en'>('pt')
  const [prompts, setPrompts] = useState<Record<'pt' | 'en', string>>({ pt: '', en: '' })

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

  const toDataUrl = (file: File, maxSize = 1200): Promise<string> => new Promise(res => {
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      // Compress if image
      if (file.type.startsWith('image/')) {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let w = img.width, h = img.height
          if (w > maxSize || h > maxSize) {
            if (w > h) { h = Math.round(h * maxSize / w); w = maxSize }
            else { w = Math.round(w * maxSize / h); h = maxSize }
          }
          canvas.width = w; canvas.height = h
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, w, h)
          res(canvas.toDataURL('image/jpeg', 0.85))
        }
        img.src = dataUrl
      } else {
        res(dataUrl)
      }
    }
    reader.readAsDataURL(file)
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

  const addFromLibrary = (charId: string) => {
    const entry = library[charId]
    if (!entry || refImgs.length >= 9) return
    setMode('omni_reference')
    for (const img of entry.images) {
      if (refImgs.length >= 9) break
      const idx = refImgs.length + 1
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

  const injectSceneAsFirstFrame = (scene: SceneAsset) => {
    if (scene.lastFrameUrl) {
      setFirstUrl(scene.lastFrameUrl); setFirstPreview(scene.lastFrameUrl)
      setMode('first_last_frames')
    } else if (scene.videoUrl) {
      setChain(true); setLastResult(scene.videoUrl)
    }
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

  /* ── Generate Video — via /api/generate (sem CORS) ── */
  const generate = async () => {
    if (!prompts[lang].trim()) { setStatus('error'); setStatusMsg('Escreva o prompt.'); return }
    setGenerating(true); setStatus('generating'); setStatusMsg('Enviando para Seedance 2.0...'); setResultUrl('')

    // Substitui @NomePersonagem por @imageN automaticamente
    let finalPrompt = prompts[lang]
    refImgs.forEach((r, i) => {
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
      prompt: finalPrompt,
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
      const now = Date.now()
      setHistory(p => [{
        id: now,
        prompt: prompts[lang].slice(0, 90) + (prompts[lang].length > 90 ? '…' : ''),
        chars: selChars.map(c => c.name).join(', '),
        mode, ratio, duration, cost, url,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
      }, ...p.slice(0, 19)])

      // Ideia 2: salvar cena como asset persistente
      if (currentEpisode) {
        const epScenes = sceneAssets.filter(s => s.episodeId === currentEpisode.id)
        const scene: SceneAsset = {
          id: `scene_${now}`, episodeId: currentEpisode.id,
          sceneNumber: epScenes.length + 1, prompt: prompts[lang],
          videoUrl: url, lastFrameUrl: url,
          characters: selChars.map(c => c.id), duration, cost,
          createdAt: new Date().toISOString(),
        }
        setSceneAssets(p => [...p, scene])
        fetch('/api/scenes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scene) }).catch(() => {})
      }
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
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>

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

              <Input placeholder="Novo episódio..." value={newEpName} onChange={e => setNewEpName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createEpisode()} style={{ width: 180 }} />
              <button onClick={createEpisode} disabled={!newEpName.trim()} style={{ background: newEpName.trim() ? C.purple : C.card, border: `1px solid ${newEpName.trim() ? C.purple : C.border}`, borderRadius: 8, padding: '8px 16px', cursor: newEpName.trim() ? 'pointer' : 'default', color: newEpName.trim() ? '#fff' : C.textDim, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>+ Criar</button>
              <button onClick={() => setShowAssets(!showAssets)} style={{ background: showAssets ? C.purple : C.card, border: `1px solid ${showAssets ? C.purple : C.border}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: showAssets ? '#fff' : C.textDim, fontSize: 13, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Assets</button>
            </div>

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

            {/* Ideia 4: Painel de Assets colapsável */}
            {showAssets && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px', maxHeight: 280, overflowY: 'auto' }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                  {[['chars', 'Personagens'], ['scenarios', 'Cenários'], ['scenes', 'Cenas']].map(([id, lbl]) => (
                    <button key={id} onClick={() => setLibTab(id as 'chars' | 'scenarios' | 'scenes')} style={{ flex: 1, padding: '6px', borderRadius: 8, background: libTab === id ? C.card : 'transparent', border: libTab === id ? `1px solid ${C.border}` : '1px solid transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: libTab === id ? C.text : C.textDim, fontFamily: 'inherit' }}>{lbl}</button>
                  ))}
                </div>

                {/* Personagens */}
                {libTab === 'chars' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {Object.values(library).length === 0 ? <div style={{ color: C.textDim, fontSize: 13 }}>Nenhum personagem salvo.</div> : Object.values(library).map(entry => (
                      <button key={entry.charId} onClick={() => addFromLibrary(entry.charId)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 6, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 80 }}>
                        {entry.images?.[0] && <img src={entry.images[0]} alt={entry.name} style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }} />}
                        <span style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{entry.emoji} {entry.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Cenários */}
                {libTab === 'scenarios' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {scenarios.length === 0 ? <div style={{ color: C.textDim, fontSize: 13 }}>Nenhum cenário salvo.</div> : scenarios.map(s => (
                      <button key={s.id} onClick={() => injectScenario(s)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 6, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 100 }}>
                        <img src={s.imageUrl} alt={s.name} style={{ width: 88, height: 50, borderRadius: 8, objectFit: 'cover' }} />
                        <span style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Cenas do episódio */}
                {libTab === 'scenes' && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {!currentEpisode ? <div style={{ color: C.textDim, fontSize: 13 }}>Selecione um episódio acima.</div> :
                      sceneAssets.filter(s => s.episodeId === currentEpisode.id).length === 0 ? <div style={{ color: C.textDim, fontSize: 13 }}>Nenhuma cena neste episódio.</div> :
                      sceneAssets.filter(s => s.episodeId === currentEpisode.id).map(scene => (
                        <button key={scene.id} onClick={() => injectSceneAsFirstFrame(scene)} title="Usar como frame inicial da próxima cena" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 6, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 100 }}>
                          <div style={{ width: 88, height: 50, borderRadius: 8, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎬</div>
                          <span style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>Cena {scene.sceneNumber}</span>
                          <span style={{ fontSize: 10, color: C.textDim }}>{scene.duration}s</span>
                        </button>
                      ))
                    }
                  </div>
                )}
              </div>
            )}

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
                {[['pt', 'PT-BR'], ['en', 'EN']].map(([l, lbl]) => (
                  <button key={l} onClick={() => setLang(l as 'pt' | 'en')} style={{ flex: 1, padding: '8px', borderRadius: 8, background: lang === l ? C.surface : 'transparent', border: lang === l ? `1px solid ${C.border}` : '1px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: lang === l ? C.text : C.textDim, transition: 'all 0.15s', fontFamily: 'inherit' }}>{lbl}</button>
                ))}
              </div>
              <textarea
                placeholder={lang === 'pt' ? 'Descreva a cena...' : 'Describe the scene...'}
                value={prompts[lang]}
                onChange={e => setPrompts(p => ({ ...p, [lang]: e.target.value }))}
                style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px', color: C.text, fontSize: 14, fontFamily: 'inherit', lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box', minHeight: 100 }}
                rows={4}
              />
              {/* Tags @ clicáveis — insere @Nome no prompt, convertido para @imageN ao enviar */}
              {refImgs.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {refImgs.map((r, i) => {
                    const tag = r.charId ? `@${r.charId}` : `@image${i + 1}`
                    const displayName = r.name || `image${i + 1}`
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

      {/* ══════════ BIBLIOTECA — Ideia 1: categorias separadas ══════════ */}
      {tab === 'library' && (
        <div style={{ padding: '26px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: 4, background: C.card, padding: 4, borderRadius: 10, border: `1px solid ${C.border}` }}>
            {[['chars', 'Personagens'], ['scenarios', 'Cenários'], ['scenes', 'Cenas']].map(([id, lbl]) => (
              <button key={id} onClick={() => setLibTab(id as 'chars' | 'scenarios' | 'scenes')} style={{ flex: 1, padding: '10px', borderRadius: 8, background: libTab === id ? C.surface : 'transparent', border: libTab === id ? `1px solid ${C.border}` : '1px solid transparent', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: libTab === id ? C.text : C.textDim, fontFamily: 'inherit' }}>{lbl}</button>
            ))}
          </div>

          {/* ═══ PERSONAGENS ═══ */}
          {libTab === 'chars' && (<>
            {/* Upload de referências */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px' }}>
              <Label>Adicionar Referências de Personagem</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>Personagem</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                    {CHARACTERS.map(char => (
                      <button key={char.id} onClick={() => { setSheetChar(char); setSheetPhotos([]) }} style={{ background: sheetChar?.id === char.id ? `${char.color}20` : C.surface, border: `1px solid ${sheetChar?.id === char.id ? char.color : C.border}`, borderRadius: 8, padding: '8px 4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <span style={{ fontSize: 20 }}>{char.emoji}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: sheetChar?.id === char.id ? char.color : C.textDim }}>{char.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>Imagens de referência ({sheetPhotos.length}/5)</div>
                  {sheetPhotos.length > 0 && (
                    <div style={{ display: 'flex', gap: 7, marginBottom: 10, flexWrap: 'wrap' }}>
                      {sheetPhotos.map((p, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <img src={p.url} alt={p.name} style={{ width: 70, height: 70, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.border}` }} />
                          <button onClick={() => setSheetPhotos(prev => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -4, right: -4, background: C.red, color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true; i.onchange = (e) => addSheetPhoto(e as unknown as React.ChangeEvent<HTMLInputElement>); i.click() }} style={{ border: `1px dashed ${C.border}`, borderRadius: 10, padding: '14px', textAlign: 'center', color: C.textDim, fontSize: 13, cursor: 'pointer' }}>Upload imagens</div>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <button onClick={saveCharRefs} disabled={!sheetChar || !sheetPhotos.length} style={{ background: sheetChar && sheetPhotos.length ? C.purple : C.card, border: `1px solid ${sheetChar && sheetPhotos.length ? C.purple : C.border}`, borderRadius: 10, padding: '12px 24px', cursor: sheetChar && sheetPhotos.length ? 'pointer' : 'default', color: sheetChar && sheetPhotos.length ? '#fff' : C.textDim, fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>
                  Salvar Referências
                </button>
              </div>
            </div>

            {/* Grid de personagens salvos */}
            {Object.keys(library).length === 0
              ? <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '40px', textAlign: 'center', color: C.textDim, fontSize: 14 }}>Nenhum personagem salvo. Suba imagens de referência acima.</div>
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
                            <button onClick={() => { const next = { ...library }; delete next[entry.charId]; setLibrary(next); deleteFromKV(entry.charId) }} style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: C.red, fontSize: 14, fontFamily: 'inherit' }}>×</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }
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
                          <button onClick={() => deleteScenario(s.id)} style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: C.red, fontSize: 14, fontFamily: 'inherit' }}>×</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </>)}

          {/* ═══ CENAS — Ideia 2 + 5 ═══ */}
          {libTab === 'scenes' && (<>
            {/* Episódios */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px' }}>
              <Label>Episódios</Label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {episodes.map(ep => (
                  <div key={ep.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => setCurrentEpisode(ep)} style={{ background: currentEpisode?.id === ep.id ? `${C.purple}20` : C.surface, border: `1px solid ${currentEpisode?.id === ep.id ? C.purple : C.border}`, borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: currentEpisode?.id === ep.id ? C.text : C.textDim, fontFamily: 'inherit' }}>{ep.name}</button>
                    <button onClick={() => deleteEpisode(ep.id)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 14, padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input placeholder="Nome do novo episódio..." value={newEpName} onChange={e => setNewEpName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createEpisode()} />
                <button onClick={createEpisode} disabled={!newEpName.trim()} style={{ background: newEpName.trim() ? C.purple : C.card, border: `1px solid ${newEpName.trim() ? C.purple : C.border}`, borderRadius: 8, padding: '8px 20px', cursor: newEpName.trim() ? 'pointer' : 'default', color: newEpName.trim() ? '#fff' : C.textDim, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>+ Criar Episódio</button>
              </div>
            </div>

            {/* Timeline de cenas */}
            {!currentEpisode
              ? <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '40px', textAlign: 'center', color: C.textDim, fontSize: 14 }}>Selecione ou crie um episódio acima.</div>
              : sceneAssets.filter(s => s.episodeId === currentEpisode.id).length === 0
              ? <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '40px', textAlign: 'center', color: C.textDim, fontSize: 14 }}>Nenhuma cena em &quot;{currentEpisode.name}&quot;. Gere cenas no Estúdio com este episódio selecionado.</div>
              : (
                <div style={{ display: 'flex', gap: 16, overflowX: 'auto', padding: '4px 0' }}>
                  {sceneAssets.filter(s => s.episodeId === currentEpisode.id).map(scene => (
                    <div key={scene.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, minWidth: 240, flexShrink: 0, overflow: 'hidden' }}>
                      <div style={{ background: C.bg, aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🎬</div>
                      <div style={{ padding: '14px' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>Cena {scene.sceneNumber}</div>
                        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 4 }}>{scene.duration}s · {scene.cost}</div>
                        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>{scene.prompt}</div>
                        <button onClick={() => { setTab('studio'); injectSceneAsFirstFrame(scene) }} style={{ width: '100%', background: C.purpleGlow, border: `1px solid ${C.purple}50`, borderRadius: 8, padding: '8px', cursor: 'pointer', color: C.purple, fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Encadear próxima cena</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </>)}
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
