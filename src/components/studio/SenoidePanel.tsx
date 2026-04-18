'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import type { Asset } from '@/lib/assets'
import { defaultEmoji } from '@/lib/assets'
import { C } from './theme'
import { Pill, Label, Input } from './atoms'
import type { CurrentUser, Episode, SceneAsset } from './types'

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
export { SenoidePanel }
