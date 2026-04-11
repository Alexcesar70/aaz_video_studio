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
interface SceneAsset { id: string; episodeId: string | null; sceneNumber: number; prompt: string; videoUrl: string; lastFrameUrl: string; characters: string[]; duration: number; cost: string; createdAt: string; projectId?: string | null }
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

/* ═══════════════════════════════════════════════════════════════
   HistoryTab — aba Histórico
   Declarado fora do AAZStudio para não ser recriado a cada render.
═══════════════════════════════════════════════════════════════ */

interface HistoryTabProps {
  scenes: SceneAsset[]
  projects: Project[]
  episodes: Episode[]
  onPlay: (scene: SceneAsset) => void
  onDownload: (url: string, filename: string) => void
  onDelete: (id: string) => void
  onMoveScene: (scene: SceneAsset) => void
  onMoveEpisode: (episode: Episode) => void
}

function SceneCard({ scene, onPlay, onDownload, onDelete, onMoveScene }: { scene: SceneAsset; onPlay: (s: SceneAsset) => void; onDownload: (url: string, filename: string) => void; onDelete: (id: string) => void; onMoveScene: (s: SceneAsset) => void }) {
  const d = new Date(scene.createdAt)
  const dateStr = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000', cursor: 'pointer' }} onClick={() => onPlay(scene)}>
        <video src={scene.videoUrl} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play().catch(() => {})} onMouseLeave={e => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0 }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)', opacity: 0.9 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(167,139,250,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff' }}>▶</div>
        </div>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Pill color={C.blue}>{scene.duration}s</Pill>
          <Pill color={C.green}>${scene.cost}</Pill>
          {scene.sceneNumber > 0 && <Pill color={C.textDim}>#{scene.sceneNumber}</Pill>}
        </div>
        <div title={scene.prompt} style={{ fontSize: 12, color: C.textDim, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{scene.prompt}</div>
        <div style={{ fontSize: 11, color: C.textDim }}>{dateStr}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onPlay(scene)} style={{ flex: 1, background: C.purpleGlow, border: `1px solid ${C.purple}50`, borderRadius: 8, padding: '7px', cursor: 'pointer', color: C.purple, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>▶ Assistir</button>
          <button onClick={() => onMoveScene(scene)} title="Mover para outro episódio/projeto" style={{ background: `${C.gold}15`, border: `1px solid ${C.gold}40`, borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: C.gold, fontSize: 12, fontFamily: 'inherit' }}>⇄</button>
          <button onClick={() => onDownload(scene.videoUrl, `aaz-${scene.id}.mp4`)} title="Baixar MP4" style={{ background: C.blueGlow, border: `1px solid ${C.blue}40`, borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: C.blue, fontSize: 12, fontFamily: 'inherit' }}>↓</button>
          <button onClick={() => onDelete(scene.id)} title="Remover do histórico" style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: C.red, fontSize: 12, fontFamily: 'inherit' }}>×</button>
        </div>
      </div>
    </div>
  )
}

function EpisodeHeader({ episode, count, onMove }: { episode: Episode; count: number; onMove: (e: Episode) => void }) {
  const name = episode.name?.trim() || '(sem nome)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: C.textDim, margin: 0 }}>🎬 {name} <span style={{ opacity: 0.6 }}>({count})</span></h3>
      <button onClick={() => onMove(episode)} title="Mover episódio para outro projeto" style={{ background: `${C.gold}15`, border: `1px solid ${C.gold}40`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: C.gold, fontSize: 11, fontFamily: 'inherit' }}>⇄ Mover</button>
    </div>
  )
}

function HistoryTab({ scenes, projects, episodes, onPlay, onDownload, onDelete, onMoveScene, onMoveEpisode }: HistoryTabProps) {
  const total = scenes.length
  const orphans = scenes.filter(s => !s.episodeId)
  const episodesWithScenes = episodes.filter(ep => scenes.some(s => s.episodeId === ep.id))
  const projectsWithContent = projects.filter(p => episodesWithScenes.some(ep => ep.projectId === p.id))
  const standaloneEpisodes = episodesWithScenes.filter(ep => !ep.projectId)
  const sceneGrid = (arr: SceneAsset[]) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
      {arr.map(s => <SceneCard key={s.id} scene={s} onPlay={onPlay} onDownload={onDownload} onDelete={onDelete} onMoveScene={onMoveScene} />)}
    </div>
  )

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, marginTop: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>🎬 Cenas ({total})</h1>
      </div>

      {total === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '48px', textAlign: 'center', color: C.textDim }}>
          <div style={{ fontSize: 42, marginBottom: 10 }}>🎬</div>
          <div style={{ fontSize: 14 }}>Nenhuma cena gerada ainda. Volte ao Estúdio e crie a primeira.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* Projetos */}
          {projectsWithContent.map(proj => {
            const projEps = episodesWithScenes.filter(ep => ep.projectId === proj.id)
            return (
              <section key={proj.id}>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>📁 {proj.name}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingLeft: 12, borderLeft: `2px solid ${C.border}` }}>
                  {projEps.map(ep => {
                    const epScenes = scenes.filter(s => s.episodeId === ep.id)
                    return (
                      <div key={ep.id}>
                        <div style={{ marginLeft: 8 }}><EpisodeHeader episode={ep} count={epScenes.length} onMove={onMoveEpisode} /></div>
                        <div style={{ marginLeft: 8 }}>{sceneGrid(epScenes)}</div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}

          {/* Episódios avulsos */}
          {standaloneEpisodes.length > 0 && (
            <section>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0, marginBottom: 12 }}>🎬 Episódios Avulsos</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {standaloneEpisodes.map(ep => {
                  const epScenes = scenes.filter(s => s.episodeId === ep.id)
                  return (
                    <div key={ep.id}>
                      <EpisodeHeader episode={ep} count={epScenes.length} onMove={onMoveEpisode} />
                      {sceneGrid(epScenes)}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Cenas órfãs (sem episódio) */}
          {orphans.length > 0 && (
            <section>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0, marginBottom: 4 }}>🎞 Cenas sem episódio</h2>
              <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>Cenas geradas sem um episódio selecionado</div>
              {sceneGrid(orphans)}
            </section>
          )}
        </div>
      )}
    </div>
  )
}

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
    const trimmed = newEpName.trim()
    if (!trimmed) return
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

  /* asset panel in studio */
  const [showAssets, setShowAssets] = useState(false)
  const [libTab, setLibTab] = useState<'chars' | 'scenarios' | 'scenes'>('scenarios')

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

  /* Player modal */
  const [playerModalScene, setPlayerModalScene] = useState<SceneAsset | null>(null)
  /* Modais de mover */
  const [moveSceneModal, setMoveSceneModal] = useState<SceneAsset | null>(null)
  const [moveEpisodeModal, setMoveEpisodeModal] = useState<Episode | null>(null)

  /* Modal: Adicionar referência ao Omni */
  const [addRefModal, setAddRefModal] = useState<'image' | 'video' | 'audio' | null>(null)

  useEffect(() => {
    const anyModal = playerModalScene || moveSceneModal || moveEpisodeModal || addRefModal
    if (!anyModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPlayerModalScene(null)
        setMoveSceneModal(null)
        setMoveEpisodeModal(null)
        setAddRefModal(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playerModalScene, moveSceneModal, moveEpisodeModal, addRefModal])

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
  const [generateAudio, setGenerateAudio] = useState(true)

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
      generate_audio: generateAudio,
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
      // Servidor agora retorna { videoUrl } — URL permanente no Vercel Blob
      const data = await res.json() as { videoUrl?: string }
      console.log('[/api/generate] resposta:', data)
      if (!data.videoUrl) throw new Error('Servidor não retornou videoUrl. Resposta: ' + JSON.stringify(data))
      const url = data.videoUrl
      setResultUrl(url); setLastResult(url); setStatus('success'); setStatusMsg('Vídeo gerado!')
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
      const scene: SceneAsset = {
        id: `scene_${now}`,
        episodeId: currentEpisode?.id ?? null,
        projectId: currentProject?.id ?? null,
        sceneNumber: epScenes.length + 1,
        prompt: prompts[lang],
        videoUrl: url, lastFrameUrl: url,
        characters: selChars.map(c => c.id), duration, cost,
        createdAt: new Date().toISOString(),
      }
      setSceneAssets(p => [...p, scene])
      fetch('/api/scenes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scene) }).catch(() => {})
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
        {[['studio', 'Estúdio'], ['director', 'Assistente de Prompt'], ['library', 'Assets']].map(([id, lbl]) => (
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

            {/* Painel de Assets colapsável */}
            {showAssets && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px', maxHeight: 280, overflowY: 'auto' }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                  {[['scenarios', 'Cenários'], ['scenes', 'Cenas']].map(([id, lbl]) => (
                    <button key={id} onClick={() => setLibTab(id as 'chars' | 'scenarios' | 'scenes')} style={{ flex: 1, padding: '6px', borderRadius: 8, background: libTab === id ? C.card : 'transparent', border: libTab === id ? `1px solid ${C.border}` : '1px solid transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: libTab === id ? C.text : C.textDim, fontFamily: 'inherit' }}>{lbl}</button>
                  ))}
                </div>

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
          {libTab === 'scenes' && (
            <HistoryTab
              scenes={sceneAssets}
              projects={projects}
              episodes={episodes}
              onPlay={(s) => setPlayerModalScene(s)}
              onDownload={downloadVideo}
              onDelete={async (id) => {
                if (!confirm('Remover esta cena? (o vídeo original permanece no Blob)')) return
                setSceneAssets(prev => prev.filter(s => s.id !== id))
                await fetch(`/api/scenes/${encodeURIComponent(id)}`, { method: 'DELETE' })
              }}
              onMoveScene={(s) => setMoveSceneModal(s)}
              onMoveEpisode={(e) => setMoveEpisodeModal(e)}
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
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   AddRefModal — Modal para adicionar referência ao Omni Reference
   Duas seções: Da Biblioteca | Do Computador
═══════════════════════════════════════════════════════════════ */

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

function MoveSceneModal({ scene, projects, episodes, onClose, onConfirm }: { scene: SceneAsset; projects: Project[]; episodes: Episode[]; onClose: () => void; onConfirm: (episodeId: string | null, projectId: string | null) => void | Promise<void> }) {
  const [projId, setProjId] = useState<string>(scene.projectId ?? '')
  const [epId, setEpId] = useState<string>(scene.episodeId ?? '')

  // Filtra episódios pelo projeto selecionado
  const availableEps = projId ? episodes.filter(e => e.projectId === projId) : episodes.filter(e => !e.projectId)

  // Se trocar de projeto, reset do episódio
  useEffect(() => {
    if (epId && !availableEps.some(e => e.id === epId)) setEpId('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projId])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0, marginBottom: 4 }}>Mover cena</h2>
          <div style={{ fontSize: 12, color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scene.prompt}</div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>Projeto</div>
          <select value={projId} onChange={e => setProjId(e.target.value)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}>
            <option value="">— Sem projeto —</option>
            {projects.map(p => <option key={p.id} value={p.id}>📁 {p.name}</option>)}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>Episódio</div>
          <select value={epId} onChange={e => setEpId(e.target.value)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}>
            <option value="">— Sem episódio (órfã) —</option>
            {availableEps.map(ep => <option key={ep.id} value={ep.id}>🎬 {ep.name?.trim() || '(sem nome)'}</option>)}
          </select>
          {projId && availableEps.length === 0 && (
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 6 }}>Nenhum episódio neste projeto. A cena vai para o projeto sem episódio.</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: C.textDim, fontSize: 13, fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={() => onConfirm(epId || null, projId || null)} style={{ background: C.purple, border: `1px solid ${C.purple}`, borderRadius: 10, padding: '10px 20px', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Mover</button>
        </div>
      </div>
    </div>
  )
}

function MoveEpisodeModal({ episode, projects, onClose, onConfirm }: { episode: Episode; projects: Project[]; onClose: () => void; onConfirm: (projectId: string | null) => void | Promise<void> }) {
  const [projId, setProjId] = useState<string>(episode.projectId ?? '')

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0, marginBottom: 4 }}>Mover episódio</h2>
          <div style={{ fontSize: 13, color: C.textDim }}>🎬 {episode.name?.trim() || '(sem nome)'}</div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>Projeto de destino</div>
          <select value={projId} onChange={e => setProjId(e.target.value)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}>
            <option value="">— Sem projeto (avulso) —</option>
            {projects.map(p => <option key={p.id} value={p.id}>📁 {p.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: C.textDim, fontSize: 13, fontFamily: 'inherit' }}>Cancelar</button>
          <button onClick={() => onConfirm(projId || null)} style={{ background: C.purple, border: `1px solid ${C.purple}`, borderRadius: 10, padding: '10px 20px', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>Mover</button>
        </div>
      </div>
    </div>
  )
}
