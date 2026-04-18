'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { C } from './theme'
import { Pill, Label, Input } from './atoms'
import type { CurrentUser, Character } from './types'

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

export { CantigasWizard, CharacterSheetWizard }
