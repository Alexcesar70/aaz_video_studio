'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { C } from '@/components/studio/theme'
import { useWorkspace } from '@/lib/workspaceContext'

interface Platform {
  id: 'youtube' | 'tiktok' | 'instagram'
  name: string
  icon: string
  ratio: string
  duration: string
  features: string[]
  color: string
  formats: string[]
}

const PLATFORMS: Platform[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    icon: '▶',
    ratio: '16:9',
    duration: '30s — 10min',
    color: '#FF0000',
    features: ['Roteiro completo com timestamps', 'Thumbnail gerada com IA', 'Título + descrição SEO', 'Tags otimizadas'],
    formats: ['Vídeo longo', 'Shorts (9:16)'],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: '♪',
    ratio: '9:16',
    duration: '15 — 60s',
    color: '#00F2EA',
    features: ['Hook nos primeiros 3s', 'Cortes rápidos', 'Trending audio matching', 'Hashtag suggestions'],
    formats: ['Vídeo vertical'],
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: '📸',
    ratio: '1:1 / 9:16',
    duration: '15 — 90s',
    color: '#E1306C',
    features: ['Reels (9:16)', 'Posts carrossel (1:1)', 'Stories (9:16)', 'Caption + hashtags'],
    formats: ['Reel', 'Carrossel', 'Story'],
  },
]

type Step = 'platform' | 'brief' | 'generating'

export default function CreatorsPage() {
  const router = useRouter()
  const { user } = useWorkspace()
  const [step, setStep] = useState<Step>('platform')
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null)
  const [selectedFormat, setSelectedFormat] = useState<string>('')
  const [brief, setBrief] = useState({
    topic: '',
    audience: '',
    tone: 'informativo',
    duration: '',
    notes: '',
  })

  const tones = [
    { id: 'informativo', label: 'Informativo', icon: '📚' },
    { id: 'divertido', label: 'Divertido', icon: '😄' },
    { id: 'inspiracional', label: 'Inspiracional', icon: '✨' },
    { id: 'tutorial', label: 'Tutorial', icon: '🎓' },
    { id: 'storytelling', label: 'Storytelling', icon: '📖' },
    { id: 'vendas', label: 'Vendas', icon: '💰' },
  ]

  const handleSelectPlatform = (p: Platform) => {
    setSelectedPlatform(p)
    setSelectedFormat(p.formats[0])
    setStep('brief')
  }

  const handleGenerate = async () => {
    if (!selectedPlatform || !brief.topic.trim()) return
    setStep('generating')

    // TODO: chamar Spielberg (Claude API) pra gerar roteiro
    // TODO: criar Projeto + Episódio + Cenas automaticamente
    // Por agora, simula delay e redireciona pro studio
    setTimeout(() => {
      router.push('/studio')
    }, 3000)
  }

  return (
    <div style={{ padding: '32px', maxWidth: 900, color: C.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 28 }}>🎯</span>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Creators</h1>
        </div>
        <p style={{ fontSize: 13, color: C.textDim, margin: 0 }}>
          Crie conteúdo otimizado pra sua plataforma. O Spielberg te ajuda com roteiro, estrutura e formato.
        </p>
      </div>

      {/* Step: escolha de plataforma */}
      {step === 'platform' && (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Pra qual plataforma?</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => handleSelectPlatform(p)}
                style={{
                  background: C.card,
                  border: `2px solid ${C.border}`,
                  borderRadius: 16,
                  padding: '28px 20px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = p.color
                  e.currentTarget.style.boxShadow = `0 4px 20px ${p.color}25`
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = C.border
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: `${p.color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20,
                  }}>
                    {p.icon}
                  </span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: C.textDim }}>{p.ratio} · {p.duration}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {p.formats.map(f => (
                    <span key={f} style={{
                      fontSize: 10, padding: '3px 8px', borderRadius: 6,
                      background: `${p.color}15`, color: p.color,
                      border: `1px solid ${p.color}30`,
                    }}>{f}</span>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  {p.features.map(f => (
                    <div key={f} style={{ fontSize: 11, color: C.textDim, display: 'flex', gap: 6 }}>
                      <span style={{ color: p.color }}>✓</span> {f}
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>

          {/* Recentes */}
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Conteúdos recentes</div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎬</div>
            <div style={{ fontSize: 14, color: C.textDim }}>Nenhum conteúdo criado ainda. Escolha uma plataforma pra começar.</div>
          </div>
        </>
      )}

      {/* Step: briefing */}
      {step === 'brief' && selectedPlatform && (
        <>
          <button
            onClick={() => setStep('platform')}
            style={{ background: 'transparent', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', marginBottom: 16, padding: 0 }}
          >
            ← Voltar pra plataformas
          </button>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24,
            padding: '12px 16px', background: `${selectedPlatform.color}10`,
            border: `1px solid ${selectedPlatform.color}30`, borderRadius: 10,
          }}>
            <span style={{ fontSize: 20 }}>{selectedPlatform.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: selectedPlatform.color }}>{selectedPlatform.name}</span>
            <span style={{ fontSize: 12, color: C.textDim }}>· {selectedFormat}</span>
          </div>

          {/* Formato (se plataforma tem múltiplos) */}
          {selectedPlatform.formats.length > 1 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textDim, marginBottom: 8 }}>FORMATO</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {selectedPlatform.formats.map(f => (
                  <button
                    key={f}
                    onClick={() => setSelectedFormat(f)}
                    style={{
                      padding: '8px 16px', borderRadius: 8,
                      background: selectedFormat === f ? `${selectedPlatform.color}20` : C.card,
                      border: `1px solid ${selectedFormat === f ? selectedPlatform.color : C.border}`,
                      color: selectedFormat === f ? selectedPlatform.color : C.textDim,
                      cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                    }}
                  >{f}</button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
            {/* Formulário */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 6 }}>SOBRE O QUE?</label>
                <textarea
                  value={brief.topic}
                  onChange={e => setBrief(p => ({ ...p, topic: e.target.value }))}
                  placeholder="Ex: 5 ferramentas de IA que todo professor deveria conhecer"
                  rows={3}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 10,
                    background: C.card, border: `1px solid ${C.border}`,
                    color: C.text, fontSize: 13, fontFamily: 'inherit',
                    resize: 'vertical', outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 6 }}>PÚBLICO-ALVO</label>
                <input
                  value={brief.audience}
                  onChange={e => setBrief(p => ({ ...p, audience: e.target.value }))}
                  placeholder="Ex: professores do ensino fundamental, 30-50 anos"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    background: C.card, border: `1px solid ${C.border}`,
                    color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 8 }}>TOM</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {tones.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setBrief(p => ({ ...p, tone: t.id }))}
                      style={{
                        padding: '10px', borderRadius: 8,
                        background: brief.tone === t.id ? `${C.purple}20` : C.card,
                        border: `1px solid ${brief.tone === t.id ? C.purple : C.border}`,
                        color: brief.tone === t.id ? C.text : C.textDim,
                        cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <span>{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textDim, display: 'block', marginBottom: 6 }}>NOTAS PRO SPIELBERG (opcional)</label>
                <textarea
                  value={brief.notes}
                  onChange={e => setBrief(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Algo específico que quer incluir? Referências, estilo, restrições..."
                  rows={2}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 10,
                    background: C.card, border: `1px solid ${C.border}`,
                    color: C.text, fontSize: 13, fontFamily: 'inherit',
                    resize: 'vertical', outline: 'none',
                  }}
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={!brief.topic.trim()}
                style={{
                  padding: '14px 24px', borderRadius: 10,
                  background: brief.topic.trim() ? `linear-gradient(135deg, ${selectedPlatform.color}, ${selectedPlatform.color}cc)` : C.card,
                  border: 'none',
                  color: brief.topic.trim() ? '#fff' : C.textDim,
                  fontSize: 14, fontWeight: 700, cursor: brief.topic.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                ✨ Spielberg, cria o roteiro!
              </button>
            </div>

            {/* Spielberg panel */}
            <div style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: '20px', display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>🎬</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Spielberg</div>
                  <div style={{ fontSize: 10, color: C.textDim }}>Diretor criativo IA</div>
                </div>
              </div>

              <div style={{ height: 1, background: C.border }} />

              <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.6 }}>
                {!brief.topic.trim() ? (
                  'Me conta sobre o que quer criar. Vou te ajudar com o roteiro, estrutura e formato ideal pra plataforma.'
                ) : (
                  <>
                    <strong style={{ color: C.text }}>Entendi!</strong> Vou criar um roteiro sobre &ldquo;{brief.topic.slice(0, 60)}{brief.topic.length > 60 ? '...' : ''}&rdquo;
                    {brief.audience && <> pra <strong style={{ color: C.text }}>{brief.audience}</strong></>}
                    {' '}no tom <strong style={{ color: C.text }}>{tones.find(t => t.id === brief.tone)?.label.toLowerCase()}</strong>.
                    <br /><br />
                    O roteiro vai ser dividido em seções — cada seção vira uma cena no BearStudio. Tudo organizado num projeto dedicado.
                  </>
                )}
              </div>

              <div style={{ marginTop: 'auto', fontSize: 10, color: C.textDim, padding: '8px 10px', background: `${C.purple}10`, borderRadius: 6, border: `1px solid ${C.purple}20` }}>
                💡 Cada seção do roteiro vira uma cena editável no BearStudio com o formato certo ({selectedPlatform?.ratio ?? '16:9'}).
              </div>
            </div>
          </div>
        </>
      )}

      {/* Step: gerando */}
      {step === 'generating' && (
        <div style={{ textAlign: 'center', padding: '80px 40px' }}>
          <div style={{
            width: 48, height: 48, margin: '0 auto 20px',
            border: `3px solid ${C.border}`,
            borderTopColor: selectedPlatform?.color ?? C.purple,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Spielberg está criando o roteiro...</div>
          <div style={{ fontSize: 13, color: C.textDim }}>
            Analisando tema, público e formato pra {selectedPlatform?.name ?? 'a plataforma'}.
            <br />Um projeto será criado automaticamente com as cenas prontas pra editar.
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  )
}
