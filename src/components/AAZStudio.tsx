'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Project, Episode, Scene, Shot, LibraryCharacter, LibraryScenario, EpisodeStatus } from '@/lib/types'
import { C, CHARACTERS } from '@/lib/constants'

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
        <Label>Shots</Label>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, textAlign: 'center', color: C.textDim, fontSize: 14 }}>
          Editor de Shot em construção (próximo commit)
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
      {view === 'shot' && (
        <div style={{ padding: 40, textAlign: 'center', color: C.textDim }}>Editor de Shot em construção</div>
      )}
      {view === 'library' && (
        <div style={{ padding: 40, textAlign: 'center', color: C.textDim }}>
          Biblioteca em refatoração.{' '}
          <button onClick={goHome} style={{ background: 'none', border: 'none', color: C.purple, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Voltar ao início</button>
        </div>
      )}
    </div>
  )
}
