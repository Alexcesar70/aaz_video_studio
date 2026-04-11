'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Project, Episode, Scene, Shot, Version, LibraryCharacter, LibraryScenario, EpisodeStatus, ShotEmotion, CameraMode } from '@/lib/types'
import { C, CHARACTERS, RATIOS, DURATIONS, EMOTIONS, CAMERA_FIXED_OPTIONS, COST_PER_SEC } from '@/lib/constants'

/* ═══════════════════════════════════════════════════════════════
   AAZ Production Studio — Workflow Hierárquico
   Projeto → Episódio → Cena → Shot → Version
═══════════════════════════════════════════════════════════════ */

/* ── Átomos UI ── */
const Pill = ({ children, color = C.gold, style = {} }: { children: React.ReactNode; color?: string; style?: React.CSSProperties }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: `${color}18`, color, border: `1px solid ${color}35`, whiteSpace: 'nowrap', ...style }}>{children}</span>
)

const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10 }}>{children}</div>
)

const Input = ({ style = {}, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', ...style }} {...props} />
)

const Textarea = ({ style = {}, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5, ...style }} {...props} />
)

const PrimaryButton = ({ children, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button disabled={disabled} {...props} style={{ background: disabled ? C.card : C.purple, border: `1px solid ${disabled ? C.border : C.purple}`, borderRadius: 10, padding: '11px 20px', cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? C.textDim : '#fff', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap', ...(props.style || {}) }}>{children}</button>
)

const SecondaryButton = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...props} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: C.textDim, fontSize: 13, fontFamily: 'inherit', whiteSpace: 'nowrap', ...(props.style || {}) }}>{children}</button>
)

type ViewKind = 'home' | 'project' | 'episode' | 'scene' | 'shot' | 'library'

export function AAZStudio() {
  const router = useRouter()

  /* ── Navegação ── */
  const [view, setView] = useState<ViewKind>('home')
  const [curProjectId, setCurProjectId] = useState<string | null>(null)
  const [curEpisodeId, setCurEpisodeId] = useState<string | null>(null)
  const [curSceneId, setCurSceneId] = useState<string | null>(null)
  const [curShotId, setCurShotId] = useState<string | null>(null)

  /* ── Dados ── */
  const [projects, setProjects] = useState<Project[]>([])
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [scenes, setScenes] = useState<Scene[]>([])
  const [shots, setShots] = useState<Shot[]>([])
  const [characters, setCharacters] = useState<Record<string, LibraryCharacter>>({})
  const [scenarios, setScenarios] = useState<LibraryScenario[]>([])

  /* ── Loaders ── */
  const loadAll = useCallback(async () => {
    try {
      const [p, e, s, sh, lib, sc] = await Promise.all([
        fetch('/api/projects').then(r => r.ok ? r.json() : []),
        fetch('/api/episodes').then(r => r.ok ? r.json() : []),
        fetch('/api/scenes').then(r => r.ok ? r.json() : []),
        fetch('/api/shots').then(r => r.ok ? r.json() : []),
        fetch('/api/library').then(r => r.ok ? r.json() : {}),
        fetch('/api/scenarios').then(r => r.ok ? r.json() : []),
      ])
      setProjects(p); setEpisodes(e); setScenes(s); setShots(sh); setCharacters(lib); setScenarios(sc)
    } catch (err) { console.error('loadAll', err) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  /* ── Entidades derivadas ── */
  const curProject = projects.find(p => p.id === curProjectId) ?? null
  const curEpisode = episodes.find(e => e.id === curEpisodeId) ?? null
  const curScene = scenes.find(s => s.id === curSceneId) ?? null
  const curShot = shots.find(s => s.id === curShotId) ?? null

  /* ── Logout ── */
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  /* ── Navegação helpers ── */
  const goHome = () => { setView('home'); setCurProjectId(null); setCurEpisodeId(null); setCurSceneId(null); setCurShotId(null) }
  const goProject = (id: string) => { setCurProjectId(id); setView('project') }
  const goEpisode = (id: string) => { setCurEpisodeId(id); setView('episode') }
  const goScene = (id: string) => { setCurSceneId(id); setView('scene') }
  const goShot = (id: string) => { setCurShotId(id); setView('shot') }

  /* ── CRUD: Projetos ── */
  const createProject = async (name: string) => {
    if (!name.trim()) return
    const p: Project = { id: `prj_${Date.now()}`, name: name.trim(), createdAt: new Date().toISOString() }
    setProjects(prev => [...prev, p])
    await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
  }
  const deleteProject = async (id: string) => {
    if (!confirm('Deletar este projeto? Os episódios viram avulsos.')) return
    setProjects(prev => prev.filter(p => p.id !== id))
    setEpisodes(prev => prev.map(e => e.projectId === id ? { ...e, projectId: null } : e))
    await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  /* ── CRUD: Episódios ── */
  const createEpisode = async (title: string, projectId: string | null) => {
    if (!title.trim()) return
    const ep: Episode = {
      id: `ep_${Date.now()}`, title: title.trim(), synopsis: '',
      projectId, characterIds: [], status: 'rascunho',
      createdAt: new Date().toISOString(),
    }
    setEpisodes(prev => [...prev, ep])
    await fetch('/api/episodes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ep) })
  }
  const updateEpisode = async (id: string, updates: Partial<Episode>) => {
    setEpisodes(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
    await fetch(`/api/episodes/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
  }
  const deleteEpisode = async (id: string) => {
    if (!confirm('Deletar este episódio e todas suas cenas e shots?')) return
    setEpisodes(prev => prev.filter(e => e.id !== id))
    setScenes(prev => prev.filter(s => s.episodeId !== id))
    setShots(prev => prev.filter(s => s.episodeId !== id))
    await fetch(`/api/episodes/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  /* ── CRUD: Cenas ── */
  const createScene = async (name: string, episodeId: string) => {
    if (!name.trim()) return
    const epScenes = scenes.filter(s => s.episodeId === episodeId)
    const sc: Scene = {
      id: `sc_${Date.now()}`, episodeId, name: name.trim(),
      order: epScenes.length + 1, characterIds: [], scenarioId: null,
      generalAction: '', createdAt: new Date().toISOString(),
    }
    setScenes(prev => [...prev, sc])
    await fetch('/api/scenes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sc) })
  }
  const updateScene = async (id: string, updates: Partial<Scene>) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    await fetch(`/api/scenes/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
  }
  const deleteScene = async (id: string) => {
    if (!confirm('Deletar esta cena e todos seus shots?')) return
    setScenes(prev => prev.filter(s => s.id !== id))
    setShots(prev => prev.filter(s => s.sceneId !== id))
    await fetch(`/api/scenes/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  /* ── CRUD: Shots ── */
  const createShot = async (sceneId: string, episodeId: string) => {
    const scShots = shots.filter(sh => sh.sceneId === sceneId)
    const shot: Shot = {
      id: `sh_${Date.now()}`, sceneId, episodeId,
      order: scShots.length + 1,
      action: '', emotion: 'tensao',
      cameraMode: 'fixed', cameraFixed: 'Medium shot',
      duration: 5, ratio: '16:9',
      versions: [], activeVersionId: null,
      createdAt: new Date().toISOString(),
    }
    setShots(prev => [...prev, shot])
    await fetch('/api/shots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(shot) })
    setCurShotId(shot.id)
    setView('shot')
  }
  const updateShot = async (id: string, updates: Partial<Shot>) => {
    setShots(prev => prev.map(sh => sh.id === id ? { ...sh, ...updates } : sh))
    await fetch(`/api/shots/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) })
  }
  const deleteShot = async (id: string) => {
    if (!confirm('Deletar este shot e todas suas versões?')) return
    setShots(prev => prev.filter(s => s.id !== id))
    await fetch(`/api/shots/${encodeURIComponent(id)}`, { method: 'DELETE' })
  }

  /* ── Breadcrumb ── */
  const Breadcrumb = () => {
    const crumbs: { label: string; onClick?: () => void }[] = [
      { label: 'Início', onClick: goHome },
    ]
    if (view === 'library') crumbs.push({ label: 'Biblioteca' })
    if (curProject && view !== 'library') crumbs.push({ label: curProject.name, onClick: () => goProject(curProject.id) })
    if (curEpisode && (view === 'episode' || view === 'scene' || view === 'shot')) {
      crumbs.push({ label: curEpisode.title, onClick: () => goEpisode(curEpisode.id) })
    }
    if (curScene && (view === 'scene' || view === 'shot')) {
      crumbs.push({ label: curScene.name, onClick: () => goScene(curScene.id) })
    }
    if (curShot && view === 'shot') {
      crumbs.push({ label: `Shot ${curShot.order}` })
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: C.surface, borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <span style={{ color: C.textDim }}>›</span>}
            {c.onClick ? (
              <button onClick={c.onClick} style={{ background: 'transparent', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', padding: 0 }}>{c.label}</button>
            ) : (
              <span style={{ color: C.text, fontWeight: 600 }}>{c.label}</span>
            )}
          </span>
        ))}
      </div>
    )
  }

  /* ── HOME SCREEN ── */
  const HomeScreen = () => {
    const [newProjectName, setNewProjectName] = useState('')
    const [newEpName, setNewEpName] = useState('')
    const standalone = episodes.filter(e => !e.projectId)

    return (
      <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
        {/* Projetos */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>📁 Projetos</h2>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Input placeholder="Nome do novo projeto..." value={newProjectName} onChange={e => setNewProjectName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { createProject(newProjectName); setNewProjectName('') } }} />
            <PrimaryButton onClick={() => { createProject(newProjectName); setNewProjectName('') }} disabled={!newProjectName.trim()}>+ Criar Projeto</PrimaryButton>
          </div>
          {projects.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, textAlign: 'center', color: C.textDim, fontSize: 14 }}>
              Nenhum projeto ainda. Projetos agrupam episódios relacionados.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
              {projects.map(p => {
                const epCount = episodes.filter(e => e.projectId === p.id).length
                return (
                  <div key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, cursor: 'pointer' }} onClick={() => goProject(p.id)}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>📁 {p.name}</div>
                    <div style={{ fontSize: 13, color: C.textDim }}>{epCount} episódio{epCount !== 1 ? 's' : ''}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Episódios avulsos */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>🎬 Episódios Avulsos</h2>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Input placeholder="Título do novo episódio avulso..." value={newEpName} onChange={e => setNewEpName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { createEpisode(newEpName, null); setNewEpName('') } }} />
            <PrimaryButton onClick={() => { createEpisode(newEpName, null); setNewEpName('') }} disabled={!newEpName.trim()}>+ Criar Episódio</PrimaryButton>
          </div>
          {standalone.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, textAlign: 'center', color: C.textDim, fontSize: 14 }}>
              Nenhum episódio avulso. Crie episódios independentes aqui (testes, promos, vídeos isolados).
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
              {standalone.map(ep => {
                const sceneCount = scenes.filter(s => s.episodeId === ep.id).length
                return (
                  <div key={ep.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, cursor: 'pointer' }} onClick={() => goEpisode(ep.id)}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>🎬 {ep.title}</div>
                    <div style={{ fontSize: 12, color: C.textDim }}>{sceneCount} cena{sceneCount !== 1 ? 's' : ''} · {ep.status}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ── PROJECT VIEW ── */
  const ProjectView = () => {
    const [newEpName, setNewEpName] = useState('')
    if (!curProject) return null
    const projectEpisodes = episodes.filter(e => e.projectId === curProject.id)

    return (
      <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, margin: 0, marginBottom: 6 }}>📁 {curProject.name}</h1>
            <div style={{ color: C.textDim, fontSize: 13 }}>{projectEpisodes.length} episódio{projectEpisodes.length !== 1 ? 's' : ''}</div>
          </div>
          <SecondaryButton onClick={() => deleteProject(curProject.id)} style={{ color: C.red, borderColor: `${C.red}40` }}>Deletar Projeto</SecondaryButton>
        </div>

        <Label>Episódios do Projeto</Label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Input placeholder="Título do novo episódio..." value={newEpName} onChange={e => setNewEpName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { createEpisode(newEpName, curProject.id); setNewEpName('') } }} />
          <PrimaryButton onClick={() => { createEpisode(newEpName, curProject.id); setNewEpName('') }} disabled={!newEpName.trim()}>+ Criar Episódio</PrimaryButton>
        </div>

        {projectEpisodes.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, textAlign: 'center', color: C.textDim, fontSize: 14 }}>Sem episódios. Crie o primeiro acima.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
            {projectEpisodes.map(ep => {
              const sceneCount = scenes.filter(s => s.episodeId === ep.id).length
              return (
                <div key={ep.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, cursor: 'pointer' }} onClick={() => goEpisode(ep.id)}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>🎬 {ep.title}</div>
                  <div style={{ fontSize: 12, color: C.textDim }}>{sceneCount} cena{sceneCount !== 1 ? 's' : ''} · {ep.status}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  /* ── EPISODE VIEW ── */
  const EpisodeView = () => {
    const [newSceneName, setNewSceneName] = useState('')
    if (!curEpisode) return null
    const epScenes = scenes.filter(s => s.episodeId === curEpisode.id).sort((a, b) => a.order - b.order)
    const toggleChar = (id: string) => {
      const cur = curEpisode.characterIds
      updateEpisode(curEpisode.id, { characterIds: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] })
    }

    return (
      <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, margin: 0 }}>🎬 {curEpisode.title}</h1>
          <SecondaryButton onClick={() => { deleteEpisode(curEpisode.id); goHome() }} style={{ color: C.red, borderColor: `${C.red}40` }}>Deletar Episódio</SecondaryButton>
        </div>

        {/* Metadados do episódio */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <Label>Título</Label>
          <Input value={curEpisode.title} onChange={e => updateEpisode(curEpisode.id, { title: e.target.value })} style={{ marginBottom: 14 }} />

          <Label>Sinopse</Label>
          <Textarea value={curEpisode.synopsis} onChange={e => updateEpisode(curEpisode.id, { synopsis: e.target.value })} rows={3} placeholder="Resumo da história do episódio..." style={{ marginBottom: 14 }} />

          <Label>Personagens principais (planejamento narrativo)</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(90px,1fr))', gap: 6, marginBottom: 14 }}>
            {CHARACTERS.map(ch => {
              const sel = curEpisode.characterIds.includes(ch.id)
              return (
                <button key={ch.id} onClick={() => toggleChar(ch.id)} style={{ background: sel ? `${ch.color}18` : C.surface, border: `1px solid ${sel ? ch.color : C.border}`, borderRadius: 8, padding: '8px 4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 20 }}>{ch.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: sel ? ch.color : C.textDim }}>{ch.name}</span>
                </button>
              )
            })}
          </div>

          <Label>Status</Label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['rascunho', 'em_producao', 'finalizado'] as EpisodeStatus[]).map(s => (
              <button key={s} onClick={() => updateEpisode(curEpisode.id, { status: s })} style={{ background: curEpisode.status === s ? `${C.purple}20` : C.surface, border: `1px solid ${curEpisode.status === s ? C.purple : C.border}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: curEpisode.status === s ? C.text : C.textDim, fontFamily: 'inherit' }}>
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Cenas */}
        <Label>Cenas</Label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Input placeholder="Nome da nova cena..." value={newSceneName} onChange={e => setNewSceneName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { createScene(newSceneName, curEpisode.id); setNewSceneName('') } }} />
          <PrimaryButton onClick={() => { createScene(newSceneName, curEpisode.id); setNewSceneName('') }} disabled={!newSceneName.trim()}>+ Criar Cena</PrimaryButton>
        </div>

        {epScenes.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, textAlign: 'center', color: C.textDim, fontSize: 14 }}>Sem cenas. Crie a primeira acima.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
            {epScenes.map(sc => {
              const shotCount = shots.filter(sh => sh.sceneId === sc.id).length
              return (
                <div key={sc.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, cursor: 'pointer' }} onClick={() => goScene(sc.id)}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>Cena {sc.order}: {sc.name}</div>
                  <div style={{ fontSize: 12, color: C.textDim }}>{shotCount} shot{shotCount !== 1 ? 's' : ''}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  /* ── SCENE VIEW ── */
  const SceneView = () => {
    if (!curScene || !curEpisode) return null
    const scShots = shots.filter(sh => sh.sceneId === curScene.id).sort((a, b) => a.order - b.order)
    const scenarioObj = scenarios.find(x => x.id === curScene.scenarioId)
    const toggleChar = (id: string) => {
      const cur = curScene.characterIds
      updateScene(curScene.id, { characterIds: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] })
    }
    const sortedChars = [...CHARACTERS].sort((a, b) => {
      const aIn = curEpisode.characterIds.includes(a.id)
      const bIn = curEpisode.characterIds.includes(b.id)
      if (aIn && !bIn) return -1
      if (!aIn && bIn) return 1
      return 0
    })

    return (
      <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, margin: 0 }}>Cena {curScene.order}: {curScene.name}</h1>
          <SecondaryButton onClick={() => { deleteScene(curScene.id); goEpisode(curEpisode.id) }} style={{ color: C.red, borderColor: `${C.red}40` }}>Deletar Cena</SecondaryButton>
        </div>

        {/* Metadados da cena */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <Label>Nome da cena</Label>
          <Input value={curScene.name} onChange={e => updateScene(curScene.id, { name: e.target.value })} style={{ marginBottom: 14 }} />

          <Label>Personagens presentes nesta cena</Label>
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>Os do episódio aparecem primeiro. Todos da biblioteca estão disponíveis.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(90px,1fr))', gap: 6, marginBottom: 14 }}>
            {sortedChars.map(ch => {
              const sel = curScene.characterIds.includes(ch.id)
              const inEpisode = curEpisode.characterIds.includes(ch.id)
              return (
                <button key={ch.id} onClick={() => toggleChar(ch.id)} style={{ background: sel ? `${ch.color}18` : C.surface, border: `1px solid ${sel ? ch.color : C.border}`, borderRadius: 8, padding: '8px 4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: inEpisode || sel ? 1 : 0.5 }}>
                  <span style={{ fontSize: 20 }}>{ch.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: sel ? ch.color : C.textDim }}>{ch.name}</span>
                </button>
              )
            })}
          </div>

          <Label>Localização (Cenário da Biblioteca)</Label>
          <select value={curScene.scenarioId ?? ''} onChange={e => updateScene(curScene.id, { scenarioId: e.target.value || null })} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit', width: '100%', marginBottom: 14 }}>
            <option value="">— Selecione um cenário —</option>
            {scenarios.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
          </select>
          {scenarioObj && <img src={scenarioObj.imageUrl} alt={scenarioObj.name} style={{ width: 200, borderRadius: 8, marginBottom: 14 }} />}
          {!curScene.scenarioId && scenarios.length === 0 && (
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>Nenhum cenário salvo. Crie na Biblioteca.</div>
          )}

          <Label>Ação geral da cena (herdada pelos shots)</Label>
          <Textarea value={curScene.generalAction} onChange={e => updateScene(curScene.id, { generalAction: e.target.value })} rows={3} placeholder="Descrição geral do que acontece na cena..." />
        </div>

        {/* Shots */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Label>Shots</Label>
          <PrimaryButton onClick={() => createShot(curScene.id, curEpisode.id)}>+ Novo Shot</PrimaryButton>
        </div>
        {scShots.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, textAlign: 'center', color: C.textDim, fontSize: 14 }}>Sem shots. Crie o primeiro acima.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
            {scShots.map(sh => {
              const active = sh.versions.find(v => v.id === sh.activeVersionId)
              return (
                <div key={sh.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, cursor: 'pointer' }} onClick={() => goShot(sh.id)}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Shot {sh.order}</div>
                  <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sh.action || '(sem ação)'}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Pill color={active?.status === 'aprovado' ? C.green : active?.status === 'rejeitado' ? C.red : C.textDim}>
                      {sh.versions.length} versão{sh.versions.length !== 1 ? 'ões' : ''}
                    </Pill>
                    <Pill color={C.blue}>{sh.duration}s</Pill>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  /* ── Helpers ── */
  const toDataUrlCompressed = (file: File, maxSize = 1200): Promise<string> => new Promise(res => {
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
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
          canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
          res(canvas.toDataURL('image/jpeg', 0.85))
        }
        img.src = dataUrl
      } else res(dataUrl)
    }
    reader.readAsDataURL(file)
  })

  /* ── LIBRARY VIEW ── */
  const LibraryView = () => {
    const [libTab, setLibTab] = useState<'chars' | 'scenarios'>('chars')
    const [selChar, setSelChar] = useState<typeof CHARACTERS[number] | null>(null)
    const [charPhotos, setCharPhotos] = useState<{ url: string; name: string }[]>([])
    const [scName, setScName] = useState('')
    const [scPhoto, setScPhoto] = useState<{ url: string; name: string } | null>(null)

    const addCharPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).slice(0, 5 - charPhotos.length)
      for (const f of files) { const url = await toDataUrlCompressed(f); setCharPhotos(p => [...p, { url, name: f.name }]) }
    }
    const saveCharRefs = async () => {
      if (!selChar || !charPhotos.length) return
      const entry: LibraryCharacter = {
        charId: selChar.id, name: selChar.name, emoji: selChar.emoji,
        images: charPhotos.map(p => p.url), createdAt: new Date().toLocaleDateString('pt-BR'),
      }
      setCharacters(prev => ({ ...prev, [selChar.id]: entry }))
      await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) })
      setCharPhotos([]); setSelChar(null)
    }
    const deleteCharRefs = async (id: string) => {
      const next = { ...characters }; delete next[id]; setCharacters(next)
      await fetch(`/api/library/${encodeURIComponent(id)}`, { method: 'DELETE' })
    }

    const addScenarioPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) { const url = await toDataUrlCompressed(f); setScPhoto({ url, name: f.name }) }
    }
    const saveScenario = async () => {
      if (!scName.trim() || !scPhoto) return
      const entry: LibraryScenario = { id: `scenario_${Date.now()}`, name: scName, imageUrl: scPhoto.url, createdAt: new Date().toLocaleDateString('pt-BR') }
      setScenarios(prev => [...prev, entry])
      await fetch('/api/scenarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) })
      setScName(''); setScPhoto(null)
    }
    const deleteScenarioEntry = async (id: string) => {
      setScenarios(prev => prev.filter(s => s.id !== id))
      await fetch(`/api/scenarios/${encodeURIComponent(id)}`, { method: 'DELETE' })
    }

    return (
      <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, margin: 0, marginBottom: 24 }}>📚 Biblioteca</h1>

        <div style={{ display: 'flex', gap: 4, background: C.card, padding: 4, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 20 }}>
          {[['chars', 'Personagens'], ['scenarios', 'Cenários']].map(([id, lbl]) => (
            <button key={id} onClick={() => setLibTab(id as 'chars' | 'scenarios')} style={{ flex: 1, padding: '10px', borderRadius: 8, background: libTab === id ? C.surface : 'transparent', border: libTab === id ? `1px solid ${C.border}` : '1px solid transparent', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: libTab === id ? C.text : C.textDim, fontFamily: 'inherit' }}>{lbl}</button>
          ))}
        </div>

        {libTab === 'chars' && (<>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <Label>Adicionar Referências de Personagem</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>Personagem</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                  {CHARACTERS.map(ch => (
                    <button key={ch.id} onClick={() => { setSelChar(ch); setCharPhotos([]) }} style={{ background: selChar?.id === ch.id ? `${ch.color}20` : C.surface, border: `1px solid ${selChar?.id === ch.id ? ch.color : C.border}`, borderRadius: 8, padding: '8px 4px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 20 }}>{ch.emoji}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: selChar?.id === ch.id ? ch.color : C.textDim }}>{ch.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>Imagens ({charPhotos.length}/5)</div>
                {charPhotos.length > 0 && (
                  <div style={{ display: 'flex', gap: 7, marginBottom: 10, flexWrap: 'wrap' }}>
                    {charPhotos.map((p, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={p.url} alt={p.name} style={{ width: 70, height: 70, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.border}` }} />
                        <button onClick={() => setCharPhotos(prev => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -4, right: -4, background: C.red, color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true; i.onchange = (e) => addCharPhoto(e as unknown as React.ChangeEvent<HTMLInputElement>); i.click() }} style={{ border: `1px dashed ${C.border}`, borderRadius: 10, padding: 14, textAlign: 'center', color: C.textDim, fontSize: 13, cursor: 'pointer' }}>Upload imagens</div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <PrimaryButton onClick={saveCharRefs} disabled={!selChar || !charPhotos.length}>Salvar Referências</PrimaryButton>
            </div>
          </div>

          {Object.keys(characters).length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, textAlign: 'center', color: C.textDim, fontSize: 14 }}>Nenhum personagem salvo.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
              {Object.values(characters).map(entry => {
                const chInfo = CHARACTERS.find(c => c.id === entry.charId)
                return (
                  <div key={entry.charId} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', gap: 4, padding: 8, overflowX: 'auto' }}>
                      {entry.images.map((img, i) => <img key={i} src={img} alt="" style={{ width: 90, height: 90, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: `1px solid ${C.border}` }} />)}
                    </div>
                    <div style={{ padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 20 }}>{entry.emoji}</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: chInfo?.color || C.text }}>{entry.name}</div>
                          <div style={{ fontSize: 12, color: C.textDim }}>{entry.images.length} imagens · {entry.createdAt}</div>
                        </div>
                      </div>
                      <button onClick={() => deleteCharRefs(entry.charId)} style={{ width: '100%', background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 8, padding: 8, cursor: 'pointer', color: C.red, fontSize: 13, fontFamily: 'inherit' }}>Remover</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>)}

        {libTab === 'scenarios' && (<>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16, alignItems: 'end' }}>
            <div>
              <Label>Nome do cenário</Label>
              <Input placeholder="Ex: Clube da Aliança..." value={scName} onChange={e => setScName(e.target.value)} />
            </div>
            <div>
              <Label>Imagem</Label>
              {scPhoto ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={scPhoto.url} alt="" style={{ width: 120, height: 70, borderRadius: 8, objectFit: 'cover', border: `1px solid ${C.border}` }} />
                  <button onClick={() => setScPhoto(null)} style={{ position: 'absolute', top: -4, right: -4, background: C.red, color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              ) : (
                <div onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = (e) => addScenarioPhoto(e as unknown as React.ChangeEvent<HTMLInputElement>); i.click() }} style={{ border: `1px dashed ${C.border}`, borderRadius: 10, padding: 14, textAlign: 'center', color: C.textDim, fontSize: 13, cursor: 'pointer' }}>Upload</div>
              )}
            </div>
            <PrimaryButton onClick={saveScenario} disabled={!scName.trim() || !scPhoto}>+ Salvar</PrimaryButton>
          </div>

          {scenarios.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, textAlign: 'center', color: C.textDim, fontSize: 14 }}>Nenhum cenário salvo.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
              {scenarios.map(s => (
                <div key={s.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
                  <img src={s.imageUrl} alt={s.name} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                  <div style={{ padding: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.blue, marginBottom: 4 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: C.textDim, marginBottom: 10 }}>{s.createdAt}</div>
                    <button onClick={() => deleteScenarioEntry(s.id)} style={{ width: '100%', background: `${C.red}15`, border: `1px solid ${C.red}40`, borderRadius: 8, padding: 8, cursor: 'pointer', color: C.red, fontSize: 13, fontFamily: 'inherit' }}>Remover</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>)}
      </div>
    )
  }

  /* ── SHOT EDITOR ── */
  const ShotEditor = () => {
    const [promptStatus, setPromptStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle')
    const [promptMsg, setPromptMsg] = useState('')
    const [generatedPt, setGeneratedPt] = useState('')
    const [generatedEn, setGeneratedEn] = useState('')
    const [advancedMode, setAdvancedMode] = useState(false)
    const [promptLang, setPromptLang] = useState<'pt' | 'en'>('en')
    const [videoStatus, setVideoStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle')
    const [videoMsg, setVideoMsg] = useState('')

    if (!curShot || !curScene || !curEpisode) return null

    // Carrega versão ativa se houver
    const activeVersion = curShot.versions.find(v => v.id === curShot.activeVersionId) ?? curShot.versions[curShot.versions.length - 1]
    // Sincroniza prompts gerados com a versão ativa na primeira abertura
    useEffect(() => {
      if (activeVersion && !generatedPt && !generatedEn) {
        setGeneratedPt(activeVersion.prompt_pt)
        setGeneratedEn(activeVersion.prompt_en)
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [curShot.id])

    const scenarioObj = scenarios.find(sc => sc.id === curScene.scenarioId)
    const sceneChars = curScene.characterIds.map(id => CHARACTERS.find(c => c.id === id)).filter(Boolean) as { id: string; name: string; emoji: string; color: string }[]

    const canGeneratePrompt = curShot.action.trim().length > 0 && !!curShot.emotion && (
      (curShot.cameraMode === 'fixed' && !!curShot.cameraFixed) ||
      (curShot.cameraMode === 'movement' && !!curShot.cameraMovement?.trim())
    )

    const runGeneratePrompt = async () => {
      setPromptStatus('generating'); setPromptMsg('Claude está escrevendo os prompts...')
      try {
        const charsDesc = sceneChars.map(c => {
          const lib = characters[c.id]
          return lib ? `${c.name} (${lib.images.length} reference images available)` : c.name
        })
        const body = {
          shot: {
            action: curShot.action,
            emotion: curShot.emotion === 'outro' ? curShot.emotionCustom : EMOTIONS.find(e => e.id === curShot.emotion)?.label,
            camera_fixed: curShot.cameraMode === 'fixed' ? curShot.cameraFixed : undefined,
            camera_movement: curShot.cameraMode === 'movement' ? curShot.cameraMovement : undefined,
            duration: curShot.duration,
          },
          scene: {
            name: curScene.name,
            general_action: curScene.generalAction,
            scenario_name: scenarioObj?.name,
            scenario_desc: undefined,
          },
          episode: {
            title: curEpisode.title,
            synopsis: curEpisode.synopsis,
            characters_desc: charsDesc,
          },
        }
        const res = await fetch('/api/scene-director', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || `Erro ${res.status}`) }
        const data = await res.json()
        const p = data.prompts as { lang: string; prompt: string }[]
        setGeneratedPt(p.find(x => x.lang === 'pt-br')?.prompt ?? '')
        setGeneratedEn(p.find(x => x.lang === 'en')?.prompt ?? '')
        setPromptStatus('success'); setPromptMsg('Prompts gerados!')
      } catch (err: unknown) {
        setPromptStatus('error'); setPromptMsg(err instanceof Error ? err.message : 'Erro ao gerar prompt.')
      }
    }

    const runGenerateVideo = async () => {
      if (!generatedEn.trim()) { setVideoStatus('error'); setVideoMsg('Gere o prompt primeiro.'); return }
      setVideoStatus('generating'); setVideoMsg('Enviando para Seedance 2.0...')
      try {
        // Coleta imagens de referência dos personagens presentes na cena
        const refImages: string[] = []
        for (const c of sceneChars) {
          const lib = characters[c.id]
          if (lib?.images?.length) refImages.push(...lib.images.slice(0, 2))
        }
        const body: Record<string, unknown> = {
          prompt: generatedEn,
          duration: curShot.duration,
          aspect_ratio: curShot.ratio,
          resolution: '720p',
          generate_audio: false,
          mode: refImages.length ? 'omni_reference' : 'text_to_video',
        }
        if (refImages.length) body.reference_images = refImages.slice(0, 9)

        const res = await fetch('/api/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || `Erro ${res.status}`) }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)

        // Salva como nova versão do shot
        const newVersion: Version = {
          id: `v_${Date.now()}`, timestamp: new Date().toISOString(),
          prompt_pt: generatedPt, prompt_en: generatedEn,
          videoUrl: url, status: 'gerado',
        }
        const newVersions = [...curShot.versions, newVersion]
        await updateShot(curShot.id, { versions: newVersions, activeVersionId: newVersion.id })

        setVideoStatus('success'); setVideoMsg('Vídeo gerado!')
      } catch (err: unknown) {
        setVideoStatus('error'); setVideoMsg(err instanceof Error ? err.message : 'Erro ao gerar vídeo.')
      }
    }

    return (
      <div style={{ padding: '32px 32px 64px', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, margin: 0 }}>Shot {curShot.order}</h1>
          <SecondaryButton onClick={() => { deleteShot(curShot.id); goScene(curScene.id) }} style={{ color: C.red, borderColor: `${C.red}40` }}>Deletar Shot</SecondaryButton>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Coluna esquerda — Form + Contexto herdado */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Contexto herdado */}
            <div style={{ background: `${C.blue}08`, border: `1px solid ${C.blue}30`, borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, marginBottom: 10, letterSpacing: '0.5px' }}>⬆ CONTEXTO HERDADO DA CENA (automático no prompt)</div>
              <div style={{ fontSize: 13, color: C.textDim, marginBottom: 6 }}><strong style={{ color: C.text }}>Episódio:</strong> {curEpisode.title}</div>
              <div style={{ fontSize: 13, color: C.textDim, marginBottom: 6 }}><strong style={{ color: C.text }}>Cena:</strong> {curScene.name}</div>
              {scenarioObj && <div style={{ fontSize: 13, color: C.textDim, marginBottom: 6 }}><strong style={{ color: C.text }}>Localização:</strong> {scenarioObj.name}</div>}
              {sceneChars.length > 0 && (
                <div style={{ fontSize: 13, color: C.textDim, marginBottom: 6 }}>
                  <strong style={{ color: C.text }}>Personagens:</strong>{' '}
                  {sceneChars.map(c => <span key={c.id} style={{ marginRight: 6 }}>{c.emoji} {c.name}</span>)}
                </div>
              )}
              {curScene.generalAction && <div style={{ fontSize: 13, color: C.textDim }}><strong style={{ color: C.text }}>Ação geral:</strong> {curScene.generalAction}</div>}
            </div>

            {/* Form: Action */}
            <div>
              <Label>Ação específica do beat *</Label>
              <Textarea value={curShot.action} onChange={e => updateShot(curShot.id, { action: e.target.value.slice(0, 200) })} rows={3} placeholder="Ex: Abraão vira o rosto devagar. Tuba para e olha para ele." />
              <div style={{ fontSize: 11, color: C.textDim, textAlign: 'right', marginTop: 4 }}>{curShot.action.length}/200</div>
            </div>

            {/* Form: Emotion */}
            <div>
              <Label>Emoção / tom *</Label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {EMOTIONS.map(e => (
                  <button key={e.id} onClick={() => updateShot(curShot.id, { emotion: e.id as ShotEmotion })} style={{ background: curShot.emotion === e.id ? `${C.purple}20` : C.card, border: `1px solid ${curShot.emotion === e.id ? C.purple : C.border}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: curShot.emotion === e.id ? C.text : C.textDim, fontFamily: 'inherit' }}>
                    {e.label}
                  </button>
                ))}
              </div>
              {curShot.emotion === 'outro' && (
                <Input value={curShot.emotionCustom ?? ''} onChange={e => updateShot(curShot.id, { emotionCustom: e.target.value })} placeholder="Descreva a emoção..." style={{ marginTop: 8 }} />
              )}
            </div>

            {/* Form: Camera */}
            <div>
              <Label>Câmera *</Label>
              <div style={{ display: 'flex', gap: 4, background: C.card, padding: 4, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 8 }}>
                {(['fixed', 'movement'] as CameraMode[]).map(m => (
                  <button key={m} onClick={() => updateShot(curShot.id, { cameraMode: m })} style={{ flex: 1, padding: '8px', borderRadius: 8, background: curShot.cameraMode === m ? C.surface : 'transparent', border: curShot.cameraMode === m ? `1px solid ${C.border}` : '1px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: curShot.cameraMode === m ? C.text : C.textDim, fontFamily: 'inherit' }}>
                    {m === 'fixed' ? 'Fixa' : 'Em Movimento'}
                  </button>
                ))}
              </div>
              {curShot.cameraMode === 'fixed' ? (
                <select value={curShot.cameraFixed ?? ''} onChange={e => updateShot(curShot.id, { cameraFixed: e.target.value })} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', fontFamily: 'inherit', width: '100%' }}>
                  <option value="">— Selecione —</option>
                  {CAMERA_FIXED_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <>
                  <Textarea value={curShot.cameraMovement ?? ''} onChange={e => updateShot(curShot.id, { cameraMovement: e.target.value })} rows={2} placeholder="Ex: Começa wide no Clube e fecha lentamente no rosto de Zaqueu capturando a emoção" />
                  <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>A IA traduz para linguagem técnica do Seedance (dolly, crane, push-in, aerial, etc.)</div>
                </>
              )}
            </div>

            {/* Duração + Ratio */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <Label>Duração</Label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {DURATIONS.map(d => (
                    <button key={d} onClick={() => updateShot(curShot.id, { duration: d })} style={{ background: curShot.duration === d ? `${C.purple}20` : C.card, border: `1px solid ${curShot.duration === d ? C.purple : C.border}`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: curShot.duration === d ? C.text : C.textDim, fontFamily: 'monospace' }}>{d}s</button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Ratio</Label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {RATIOS.map(r => (
                    <button key={r} onClick={() => updateShot(curShot.id, { ratio: r })} style={{ background: curShot.ratio === r ? `${C.purple}20` : C.card, border: `1px solid ${curShot.ratio === r ? C.purple : C.border}`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: curShot.ratio === r ? C.text : C.textDim, fontFamily: 'monospace' }}>{r}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Gerar Prompt */}
            <PrimaryButton onClick={runGeneratePrompt} disabled={!canGeneratePrompt || promptStatus === 'generating'} style={{ padding: '14px', fontSize: 15 }}>
              {promptStatus === 'generating' ? '⟳ Gerando Prompt...' : '⚡ Gerar Prompt'}
            </PrimaryButton>
            {promptStatus !== 'idle' && (
              <div style={{ textAlign: 'center' }}>
                <Pill color={promptStatus === 'success' ? C.green : promptStatus === 'error' ? C.red : C.purple}>{promptMsg}</Pill>
              </div>
            )}
          </div>

          {/* Coluna direita — Prompt + Vídeo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Prompt gerado */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Label>Prompt Gerado</Label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textDim, cursor: 'pointer' }}>
                  <input type="checkbox" checked={advancedMode} onChange={e => setAdvancedMode(e.target.checked)} style={{ accentColor: C.purple }} />
                  Modo avançado (editar)
                </label>
              </div>
              <div style={{ display: 'flex', gap: 4, background: C.card, padding: 4, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 8 }}>
                {(['pt', 'en'] as const).map(l => (
                  <button key={l} onClick={() => setPromptLang(l)} style={{ flex: 1, padding: '8px', borderRadius: 8, background: promptLang === l ? C.surface : 'transparent', border: promptLang === l ? `1px solid ${C.border}` : '1px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: promptLang === l ? C.text : C.textDim, fontFamily: 'inherit' }}>{l === 'pt' ? 'PT-BR' : 'EN'}</button>
                ))}
              </div>
              <Textarea
                value={promptLang === 'pt' ? generatedPt : generatedEn}
                onChange={e => promptLang === 'pt' ? setGeneratedPt(e.target.value) : setGeneratedEn(e.target.value)}
                readOnly={!advancedMode}
                rows={6}
                placeholder={promptStatus === 'idle' ? 'Clique em "Gerar Prompt" para criar o prompt automaticamente' : ''}
                style={{ opacity: advancedMode ? 1 : 0.9 }}
              />
            </div>

            {/* Gerar Vídeo */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 13, color: C.textDim }}>{curShot.duration}s · ${COST_PER_SEC}/s</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.green, fontFamily: 'monospace' }}>${(curShot.duration * COST_PER_SEC).toFixed(2)}</div>
            </div>

            <PrimaryButton onClick={runGenerateVideo} disabled={!generatedEn.trim() || videoStatus === 'generating'} style={{ padding: '14px', fontSize: 15 }}>
              {videoStatus === 'generating' ? '⟳ Gerando Vídeo...' : 'Gerar Vídeo'}
            </PrimaryButton>
            {videoStatus !== 'idle' && (
              <div style={{ textAlign: 'center' }}>
                <Pill color={videoStatus === 'success' ? C.green : videoStatus === 'error' ? C.red : C.purple}>{videoMsg}</Pill>
              </div>
            )}

            {/* Vídeo */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {activeVersion ? (
                <video src={activeVersion.videoUrl} controls autoPlay loop style={{ width: '100%', borderRadius: 8 }} />
              ) : (
                <div style={{ textAlign: 'center', color: C.textDim, padding: 40 }}>
                  <div style={{ fontSize: 42, marginBottom: 10 }}>🎬</div>
                  <div>O vídeo aparecerá aqui</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── RENDER ── */
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", fontSize: 14 }}>

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text, cursor: 'pointer' }} onClick={goHome}>AAZ Studio</div>
          <Pill color={C.textDim}>Seedance 2.0</Pill>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setView('library')} style={{ background: view === 'library' ? `${C.purple}18` : 'transparent', border: `1px solid ${view === 'library' ? C.purple : C.border}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: view === 'library' ? C.purple : C.textDim, fontSize: 13, fontFamily: 'inherit' }}>📚 Biblioteca</button>
          <button onClick={handleLogout} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: C.textDim, fontSize: 13, fontFamily: 'inherit' }}>Sair</button>
        </div>
      </div>

      <Breadcrumb />

      {view === 'home' && <HomeScreen />}
      {view === 'project' && <ProjectView />}
      {view === 'episode' && <EpisodeView />}
      {view === 'scene' && <SceneView />}
      {view === 'shot' && <ShotEditor />}
      {view === 'library' && <LibraryView />}
    </div>
  )
}
