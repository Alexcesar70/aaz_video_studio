'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { VIDEO_ENGINES, DEFAULT_ENGINE_ID, getEngine } from '@/lib/videoEngines'

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

/* ── Storage — biblioteca de sheets compartilhada via Vercel KV ── */

/* ── Types ── */
interface Character { id: string; name: string; emoji: string; color: string; desc: string }
interface RefItem { url: string; label: string; name: string; fromLib?: boolean; charId?: string }
interface LibraryEntry { charId: string; name: string; emoji: string; images: string[]; createdAt: string }
interface ScenarioEntry { id: string; name: string; imageUrl: string; createdAt: string }
interface Project { id: string; name: string; createdAt: string }
interface Episode { id: string; name: string; projectId?: string | null; createdAt: string }
type SceneStatus = 'draft' | 'approved' | 'rejected'
interface SceneAsset { id: string; episodeId: string | null; sceneNumber: number; title?: string; prompt: string; videoUrl: string; lastFrameUrl: string; characters: string[]; duration: number; cost: string; createdAt: string; projectId?: string | null; status?: SceneStatus }
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
  onDeleteEpisode: (episode: Episode) => void
  onPlayEpisodeSequential: (episode: Episode) => void
  onPlayProjectSequential: (project: Project) => void
  onSetSceneStatus: (sceneId: string, status: SceneStatus) => void
  onRenameEpisode: (episodeId: string, newName: string) => void
}

function SceneCard({ scene, onPlay, onDownload, onDelete, onMoveScene, onSetStatus }: { scene: SceneAsset; onPlay: (s: SceneAsset) => void; onDownload: (url: string, filename: string) => void; onDelete: (id: string) => void; onMoveScene: (s: SceneAsset) => void; onSetStatus: (sceneId: string, status: SceneStatus) => void }) {
  const d = new Date(scene.createdAt)
  const dateStr = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const status = scene.status ?? 'draft'
  const statusColor = status === 'approved' ? C.green : status === 'rejected' ? C.red : C.gold
  const statusLabel = status === 'approved' ? 'Aprovada' : status === 'rejected' ? 'Rejeitada' : 'Rascunho'
  const cardOpacity = status === 'rejected' ? 0.55 : 1
  return (
    <div style={{ background: C.card, border: `1px solid ${status === 'approved' ? `${C.green}60` : C.border}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: cardOpacity, transition: 'opacity 0.2s' }}>
      <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000', cursor: 'pointer' }} onClick={() => onPlay(scene)}>
        <video src={scene.videoUrl} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play().catch(() => {})} onMouseLeave={e => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0 }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)', opacity: 0.9 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(167,139,250,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff' }}>▶</div>
        </div>
        {/* Badge de status no canto superior esquerdo */}
        <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: '3px 9px', backdropFilter: 'blur(6px)' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', letterSpacing: '0.3px' }}>{statusLabel}</span>
        </div>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Título da cena (se houver) + número */}
        {(scene.title || scene.sceneNumber > 0) && (
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>
            {scene.sceneNumber > 0 && <span style={{ color: C.purple }}>#{scene.sceneNumber}</span>}
            {scene.title && <span style={{ marginLeft: scene.sceneNumber > 0 ? 6 : 0 }}>— {scene.title}</span>}
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Pill color={C.blue}>{scene.duration}s</Pill>
          <Pill color={C.green}>${scene.cost}</Pill>
        </div>
        <div title={scene.prompt} style={{ fontSize: 12, color: C.textDim, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{scene.prompt}</div>
        <div style={{ fontSize: 11, color: C.textDim }}>{dateStr}</div>

        {/* Botões de status */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => onSetStatus(scene.id, status === 'approved' ? 'draft' : 'approved')}
            title={status === 'approved' ? 'Clique para voltar a rascunho' : 'Marcar como aprovada'}
            style={{ flex: 1, background: status === 'approved' ? C.green : `${C.green}15`, border: `1px solid ${status === 'approved' ? C.green : `${C.green}40`}`, borderRadius: 8, padding: '6px', cursor: 'pointer', color: status === 'approved' ? '#fff' : C.green, fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}
          >✓ Aprovar</button>
          <button
            onClick={() => onSetStatus(scene.id, status === 'rejected' ? 'draft' : 'rejected')}
            title={status === 'rejected' ? 'Clique para voltar a rascunho' : 'Marcar como rejeitada (some dos players)'}
            style={{ flex: 1, background: status === 'rejected' ? C.red : `${C.red}15`, border: `1px solid ${status === 'rejected' ? C.red : `${C.red}40`}`, borderRadius: 8, padding: '6px', cursor: 'pointer', color: status === 'rejected' ? '#fff' : C.red, fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}
          >⊘ Rejeitar</button>
        </div>

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

function EpisodeHeader({ episode, count, onMove, onDelete, onPlaySequential, onRename }: { episode: Episode; count: number; onMove: (e: Episode) => void; onDelete: (e: Episode) => void; onPlaySequential?: (e: Episode) => void; onRename: (episodeId: string, newName: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const name = episode.name?.trim() || '(sem nome)'

  const commit = () => {
    if (draft.trim()) onRename(episode.id, draft)
    setEditing(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
      {editing ? (
        <Input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            else if (e.key === 'Escape') setEditing(false)
          }}
          style={{ maxWidth: 260, padding: '6px 10px', fontSize: 13 }}
        />
      ) : (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: C.textDim, margin: 0 }}>🎬 {name} <span style={{ opacity: 0.6 }}>({count})</span></h3>
          <button onClick={() => { setDraft(episode.name?.trim() || ''); setEditing(true) }} title="Renomear episódio" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.textDim, fontSize: 12, padding: 2, fontFamily: 'inherit' }}>✎</button>
        </>
      )}
      {onPlaySequential && count >= 2 && (
        <button onClick={() => onPlaySequential(episode)} title="Assistir todas as cenas do episódio em sequência" style={{ background: C.purpleGlow, border: `1px solid ${C.purple}50`, borderRadius: 6, padding: '3px 10px', cursor: 'pointer', color: C.purple, fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>▶ Assistir episódio</button>
      )}
      <button onClick={() => onMove(episode)} title="Mover episódio para outro projeto" style={{ background: `${C.gold}15`, border: `1px solid ${C.gold}40`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: C.gold, fontSize: 11, fontFamily: 'inherit' }}>⇄ Mover</button>
      <button onClick={() => onDelete(episode)} title="Deletar episódio (e todas as cenas dele)" style={{ background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: C.red, fontSize: 11, fontFamily: 'inherit' }}>× Deletar</button>
    </div>
  )
}

function HistoryTab({ scenes, projects, episodes, onPlay, onDownload, onDelete, onMoveScene, onMoveEpisode, onDeleteEpisode, onPlayEpisodeSequential, onPlayProjectSequential, onSetSceneStatus, onRenameEpisode }: HistoryTabProps) {
  const total = scenes.length
  const orphans = scenes.filter(s => !s.episodeId)
  const episodesWithScenes = episodes.filter(ep => scenes.some(s => s.episodeId === ep.id))
  const projectsWithContent = projects.filter(p => episodesWithScenes.some(ep => ep.projectId === p.id))
  const standaloneEpisodes = episodesWithScenes.filter(ep => !ep.projectId)
  const sceneGrid = (arr: SceneAsset[]) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
      {arr.map(s => <SceneCard key={s.id} scene={s} onPlay={onPlay} onDownload={onDownload} onDelete={onDelete} onMoveScene={onMoveScene} onSetStatus={onSetSceneStatus} />)}
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
            const projScenesCount = scenes.filter(s => projEps.some(e => e.id === s.episodeId)).length
            return (
              <section key={proj.id}>
                {/* Card do projeto com nome + botão de destaque */}
                <div style={{ background: `linear-gradient(135deg, ${C.purple}14, ${C.purple}06)`, border: `1px solid ${C.purple}40`, borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>📁 {proj.name}</h2>
                    <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>
                      {projEps.length} episódio{projEps.length !== 1 ? 's' : ''} · {projScenesCount} cena{projScenesCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {projScenesCount >= 2 && (
                    <button
                      onClick={() => onPlayProjectSequential(proj)}
                      title="Assistir todas as cenas do projeto em sequência"
                      style={{ background: C.purple, border: `1px solid ${C.purple}`, borderRadius: 10, padding: '10px 20px', cursor: 'pointer', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', boxShadow: `0 4px 14px ${C.purple}40`, whiteSpace: 'nowrap' }}
                    >▶ Assistir projeto inteiro</button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingLeft: 12, borderLeft: `2px solid ${C.border}` }}>
                  {projEps.map(ep => {
                    const epScenes = scenes.filter(s => s.episodeId === ep.id)
                    return (
                      <div key={ep.id}>
                        <div style={{ marginLeft: 8 }}><EpisodeHeader episode={ep} count={epScenes.length} onMove={onMoveEpisode} onDelete={onDeleteEpisode} onPlaySequential={onPlayEpisodeSequential} onRename={onRenameEpisode} /></div>
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
                      <EpisodeHeader episode={ep} count={epScenes.length} onMove={onMoveEpisode} onDelete={onDeleteEpisode} onPlaySequential={onPlayEpisodeSequential} onRename={onRenameEpisode} />
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

  const [libTab, setLibTab] = useState<'chars' | 'scenarios' | 'scenes'>('chars')

  /* scene director — compartilhado entre modo inline (Estúdio) e aba separada (legada) */
  const [sdDesc, setSdDesc] = useState('')
  const [sdSetting, setSdSetting] = useState('')
  const [sdEmotion, setSdEmotion] = useState('')
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

  // Lista de personagens disponíveis para mention, filtrada por query
  const mentionMatches = useMemo(() => {
    if (!mention) return [] as Character[]
    const q = mention.query.toLowerCase()
    // Prioriza personagens que têm imagens salvas na biblioteca
    const all = CHARACTERS
      .filter(c => c.id.toLowerCase().startsWith(q) || c.name.toLowerCase().startsWith(q))
      .sort((a, b) => {
        const aHas = library[a.id]?.images?.length ? 1 : 0
        const bHas = library[b.id]?.images?.length ? 1 : 0
        return bHas - aHas
      })
    return all.slice(0, 7)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mention, library])

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

  const selectMention = (char: Character) => {
    if (!mention) return
    const before = sdDesc.slice(0, mention.start)
    const after = sdDesc.slice(mention.start + 1 + mention.query.length)
    const replacement = `@${char.id} `
    const newText = before + replacement + after
    setSdDesc(newText)
    setMention(null)

    // Adiciona ao sidebar direito (se não estiver)
    if (!selChars.find(c => c.id === char.id)) {
      setSelChars(p => [...p, char])
    }

    // Se o personagem tem refs na biblioteca, FORÇA a entrada delas no Omni
    // (independente do modo atual — muda para omni_reference se necessário).
    // Isso garante que o @id no prompt final vai ter uma imagem correspondente.
    const entry = library[char.id]
    if (entry?.images?.length) {
      if (mode !== 'omni_reference') setMode('omni_reference')
      setRefImgs(p => {
        const next = [...p]
        for (const img of entry.images) {
          if (next.length >= 9) break
          if (next.some(r => r.url === img)) continue
          next.push({ url: img, label: `@image${next.length + 1}`, name: char.name, fromLib: true, charId: char.id })
        }
        return next
      })
    }

    // Reposiciona o cursor depois do nome inserido
    window.setTimeout(() => {
      const ta = sdDescRef.current
      if (ta) {
        const pos = before.length + replacement.length
        ta.focus()
        ta.setSelectionRange(pos, pos)
      }
    }, 0)
  }

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
    if (!promptMention) return [] as Character[]
    const q = promptMention.query.toLowerCase()
    const all = CHARACTERS
      .filter(c => c.id.toLowerCase().startsWith(q) || c.name.toLowerCase().startsWith(q))
      .sort((a, b) => {
        const aHas = library[a.id]?.images?.length ? 1 : 0
        const bHas = library[b.id]?.images?.length ? 1 : 0
        return bHas - aHas
      })
    return all.slice(0, 7)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptMention, library])

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

  const selectPromptMention = (char: Character) => {
    if (!promptMention) return
    const current = prompts[lang]
    const before = current.slice(0, promptMention.start)
    const after = current.slice(promptMention.start + 1 + promptMention.query.length)
    const replacement = `@${char.id} `
    const newText = before + replacement + after
    setPrompts(p => ({ ...p, [lang]: newText }))
    setPromptMention(null)

    // Adiciona ao sidebar direito (se não estiver)
    if (!selChars.find(c => c.id === char.id)) {
      setSelChars(p => [...p, char])
    }

    // Se tem refs na biblioteca, força modo omni e injeta direto no refImgs
    const entry = library[char.id]
    if (entry?.images?.length) {
      if (mode !== 'omni_reference') setMode('omni_reference')
      setRefImgs(p => {
        const next = [...p]
        for (const img of entry.images) {
          if (next.length >= 9) break
          if (next.some(r => r.url === img)) continue
          next.push({ url: img, label: `@image${next.length + 1}`, name: char.name, fromLib: true, charId: char.id })
        }
        return next
      })
    }

    // Reposiciona o cursor
    window.setTimeout(() => {
      const ta = promptTextareaRef.current
      if (ta) {
        const pos = before.length + replacement.length
        ta.focus()
        ta.setSelectionRange(pos, pos)
      }
    }, 0)
  }

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

      const res = await fetch('/api/scene-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene_description: sdDesc,
          characters: allCharIds.length ? allCharIds : undefined,
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
    const anyModal = playerModalScene || moveSceneModal || moveEpisodeModal || addRefModal || confirmModal || sequentialPlayer
    if (!anyModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPlayerModalScene(null)
        setMoveSceneModal(null)
        setMoveEpisodeModal(null)
        setAddRefModal(null)
        setConfirmModal(null)
        setSequentialPlayer(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playerModalScene, moveSceneModal, moveEpisodeModal, addRefModal, confirmModal, sequentialPlayer])

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
  const cost = (duration * engine.pricePerSecond).toFixed(2)
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
    // Navega pro Estúdio e ativa encadeamento usando o vídeo como referência
    setTab('studio')
    setLastResult(scene.videoUrl)
    setChain(true)
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
      setSdStatus('idle'); setSdMsg('')
      setRefImgs([]); setRefVids([]); setRefAuds([])
      setFirstUrl(''); setLastUrl(''); setFirstPreview(''); setLastPreview('')
      setResultUrl(''); setStatus('idle'); setStatusMsg('')
      setChain(false)
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
      const entry = library[id]
      if (!entry?.images?.length) continue
      const char = CHARACTERS.find(c => c.id === id)!
      addedChars.push(char)
      for (const img of entry.images) {
        if (workingRefImgs.length >= 9) break
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
          <Pill color={C.textDim}>{engine.name}</Pill>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Pill color={C.green}>~${engine.pricePerSecond}/s</Pill>
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
        {[['studio', 'Estúdio'], ['library', 'Assets']].map(([id, lbl]) => (
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
                      <div style={{ position: 'absolute', ...(mention.dir === 'up' ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }), left: 0, right: 0, background: C.card, border: `1px solid ${C.purple}60`, borderRadius: 10, boxShadow: `0 8px 24px rgba(0,0,0,0.4)`, zIndex: 50, maxHeight: 260, overflowY: 'auto' }}>
                        <div style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px', borderBottom: `1px solid ${C.border}` }}>
                          PERSONAGEM {mention.query && `· "${mention.query}"`}
                        </div>
                        {mentionMatches.map((char, i) => {
                          const hasRefs = !!library[char.id]?.images?.length
                          const isHighlighted = i === mention.highlightIdx
                          return (
                            <button
                              key={char.id}
                              onMouseDown={e => { e.preventDefault(); selectMention(char) }}
                              onMouseEnter={() => setMention(m => m ? { ...m, highlightIdx: i } : m)}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: isHighlighted ? `${C.purple}20` : 'transparent', border: 'none', cursor: 'pointer', color: C.text, fontSize: 13, fontFamily: 'inherit', textAlign: 'left' }}
                            >
                              <span style={{ fontSize: 20 }}>{char.emoji}</span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                                <span style={{ fontWeight: 600, color: isHighlighted ? C.purple : C.text }}>{char.name}</span>
                                <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>@{char.id}</span>
                              </div>
                              {hasRefs ? (
                                <span style={{ fontSize: 9, color: C.green, background: `${C.green}15`, padding: '2px 8px', borderRadius: 6, border: `1px solid ${C.green}40`, whiteSpace: 'nowrap' }}>
                                  {library[char.id].images.length} refs
                                </span>
                              ) : (
                                <span style={{ fontSize: 9, color: C.textDim, whiteSpace: 'nowrap' }}>sem refs</span>
                              )}
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
                      <div style={{ fontSize: 11, fontWeight: 600, color: C.purple, marginBottom: 6, letterSpacing: '0.3px' }}>EMOÇÃO / TOM (opcional)</div>
                      <Input placeholder="Ex: alegria, tensão, reflexão..." value={sdEmotion} onChange={e => setSdEmotion(e.target.value)} />
                    </div>
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
                    disabled={!sdDesc.trim() || sdStatus === 'generating'}
                    style={{ background: !sdDesc.trim() || sdStatus === 'generating' ? C.card : C.purple, border: `1px solid ${!sdDesc.trim() || sdStatus === 'generating' ? C.border : C.purple}`, borderRadius: 10, padding: '12px', cursor: !sdDesc.trim() || sdStatus === 'generating' ? 'not-allowed' : 'pointer', color: !sdDesc.trim() || sdStatus === 'generating' ? C.textDim : '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}
                  >
                    {sdStatus === 'generating' ? '⟳ Claude escrevendo...' : '⚡ Gerar Prompt com IA'}
                  </button>

                  {sdStatus !== 'idle' && sdStatus !== 'generating' && (
                    <div style={{ textAlign: 'center' }}>
                      <Pill color={sdStatus === 'success' ? C.green : C.red}>{sdMsg}</Pill>
                    </div>
                  )}
                </div>
              )}

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
                  <div style={{ position: 'absolute', ...(promptMention.dir === 'up' ? { bottom: '100%', marginBottom: 4 } : { top: '100%', marginTop: 4 }), left: 0, right: 0, background: C.card, border: `1px solid ${C.purple}60`, borderRadius: 10, boxShadow: `0 8px 24px rgba(0,0,0,0.4)`, zIndex: 50, maxHeight: 260, overflowY: 'auto' }}>
                    <div style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: C.textDim, letterSpacing: '0.5px', borderBottom: `1px solid ${C.border}` }}>
                      PERSONAGEM {promptMention.query && `· "${promptMention.query}"`}
                    </div>
                    {promptMentionMatches.map((char, i) => {
                      const hasRefs = !!library[char.id]?.images?.length
                      const isHighlighted = i === promptMention.highlightIdx
                      return (
                        <button
                          key={char.id}
                          onMouseDown={e => { e.preventDefault(); selectPromptMention(char) }}
                          onMouseEnter={() => setPromptMention(m => m ? { ...m, highlightIdx: i } : m)}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: isHighlighted ? `${C.purple}20` : 'transparent', border: 'none', cursor: 'pointer', color: C.text, fontSize: 13, fontFamily: 'inherit', textAlign: 'left' }}
                        >
                          <span style={{ fontSize: 20 }}>{char.emoji}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                            <span style={{ fontWeight: 600, color: isHighlighted ? C.purple : C.text }}>{char.name}</span>
                            <span style={{ fontSize: 10, color: C.textDim, fontFamily: 'monospace' }}>@{char.id}</span>
                          </div>
                          {hasRefs ? (
                            <span style={{ fontSize: 9, color: C.green, background: `${C.green}15`, padding: '2px 8px', borderRadius: 6, border: `1px solid ${C.green}40`, whiteSpace: 'nowrap' }}>
                              {library[char.id].images.length} refs
                            </span>
                          ) : (
                            <span style={{ fontSize: 9, color: C.textDim, whiteSpace: 'nowrap' }}>sem refs</span>
                          )}
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
                      {eng.name} · ~${eng.pricePerSecond}/s
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={generate} disabled={generating} style={{ flex: 1, background: generating ? C.card : C.purple, border: `1px solid ${generating ? C.border : C.purple}`, borderRadius: 12, padding: '12px 16px', cursor: generating ? 'not-allowed' : 'pointer', color: generating ? C.textDim : '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.2s', alignSelf: 'flex-end' }}>
                {generating ? '⟳ Gerando...' : 'Gerar Cena'}
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

            {/* Custo (preço estimado baseado na engine selecionada) */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, color: C.textDim }}>{duration}s · ~${engine.pricePerSecond}/s</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: C.green, fontFamily: 'monospace' }}>~${cost}</div>
              </div>
              <div style={{ fontSize: 10, color: C.textDim, fontStyle: 'italic', letterSpacing: '0.3px' }}>
                Preço estimado · {engine.name} · o valor real cobrado pelo Segmind pode variar
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

      {/* ══════════ ASSETS — Personagens, Cenários, Cenas ══════════ */}
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
          </>)}

          {/* ═══ CENAS — Ideia 2 + 5 ═══ */}
          {libTab === 'scenes' && (
            <HistoryTab
              scenes={sceneAssets}
              projects={projects}
              episodes={episodes}
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
