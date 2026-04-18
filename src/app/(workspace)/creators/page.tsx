'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { C } from '@/components/studio/theme'
import { useWorkspace } from '@/lib/workspaceContext'

type Tab = 'creations' | 'references' | 'channels'

interface Creation {
  id: string
  name: string
  platform: string
  createdAt: string
  scenesCount: number
  status: string
}

interface Channel {
  id: string
  platform: string
  name: string
  referenceImages: string[]
  brandColors: string[]
  thumbnailStyle: string
}

const PLATFORM_META: Record<string, { icon: string; color: string; label: string }> = {
  youtube: { icon: '▶', color: '#FF0000', label: 'YouTube' },
  tiktok: { icon: '♪', color: '#00F2EA', label: 'TikTok' },
  instagram: { icon: '📸', color: '#E1306C', label: 'Instagram' },
}

export default function CreatorsHub() {
  const router = useRouter()
  const { user } = useWorkspace()
  const [tab, setTab] = useState<Tab>('creations')
  const [creations, setCreations] = useState<Creation[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [references, setReferences] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.ok ? r.json() : []),
    ]).then(([projects]) => {
      const arr = Array.isArray(projects) ? projects : []
      setCreations(arr
        .filter((p: { name?: string }) => p.name?.match(/^(YOUTUBE|TIKTOK|INSTAGRAM)\s·/i))
        .map((p: { id: string; name: string; createdAt: string }) => {
          const platform = p.name.split('·')[0].trim().toLowerCase()
          return {
            id: p.id,
            name: p.name.replace(/^(YOUTUBE|TIKTOK|INSTAGRAM)\s·\s/i, ''),
            platform,
            createdAt: p.createdAt,
            scenesCount: 0,
            status: 'ready',
          }
        })
      )
    }).finally(() => setLoading(false))
  }, [])

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'creations', label: 'Minhas Criações', count: creations.length },
    { id: 'references', label: 'Referências' },
    { id: 'channels', label: 'Meus Canais' },
  ]

  return (
    <div style={{ padding: '32px', color: C.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>🎯</span>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Creators</h1>
          </div>
          <p style={{ fontSize: 13, color: C.textDim, margin: '4px 0 0 38px' }}>
            Seu hub de conteúdo pra redes sociais
          </p>
        </div>
        <button
          onClick={() => router.push('/creators/new')}
          style={{
            background: `linear-gradient(135deg, ${C.purple}, #534AB7)`,
            border: 'none', borderRadius: 10, padding: '12px 24px',
            color: '#fff', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          ✨ Novo Conteúdo
        </button>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {Object.entries(PLATFORM_META).map(([id, meta]) => {
          const count = creations.filter(c => c.platform === id).length
          return (
            <div key={id} style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{
                width: 36, height: 36, borderRadius: 8,
                background: `${meta.color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16,
              }}>{meta.icon}</span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: meta.color }}>{count}</div>
                <div style={{ fontSize: 11, color: C.textDim }}>{meta.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: C.card, padding: 4, borderRadius: 10, border: `1px solid ${C.border}` }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '10px', borderRadius: 8,
              background: tab === t.id ? C.surface : 'transparent',
              border: tab === t.id ? `1px solid ${C.border}` : '1px solid transparent',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              color: tab === t.id ? C.text : C.textDim, fontFamily: 'inherit',
            }}
          >
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* Tab: Criações */}
      {tab === 'creations' && (
        <>
          {loading ? (
            <div style={{ color: C.textDim, padding: '40px', textAlign: 'center' }}>Carregando...</div>
          ) : creations.length === 0 ? (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '60px 40px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Nenhum conteúdo criado ainda</div>
              <div style={{ fontSize: 13, color: C.textDim, marginBottom: 20 }}>
                Use o Spielberg pra criar roteiros otimizados pra YouTube, TikTok e Instagram.
              </div>
              <button onClick={() => router.push('/creators/new')}
                style={{ background: C.purple, border: 'none', borderRadius: 8, padding: '10px 20px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                ✨ Criar primeiro conteúdo
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {creations.map(c => {
                const meta = PLATFORM_META[c.platform] ?? PLATFORM_META.youtube
                return (
                  <div key={c.id} style={{
                    background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                    padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: `${meta.color}20`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14,
                      }}>{meta.icon}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: C.textDim }}>
                          {meta.label} · {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {/* Repurpose buttons */}
                      {Object.entries(PLATFORM_META)
                        .filter(([id]) => id !== c.platform)
                        .map(([id, m]) => (
                          <button key={id}
                            onClick={() => router.push(`/creators/new?repurpose=${c.id}&platform=${id}`)}
                            title={`Adaptar pra ${m.label}`}
                            style={{
                              width: 32, height: 32, borderRadius: 6,
                              background: `${m.color}15`, border: `1px solid ${m.color}30`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', fontSize: 12,
                            }}
                          >{m.icon}</button>
                        ))
                      }
                      <button onClick={() => router.push('/studio')}
                        style={{
                          padding: '6px 14px', borderRadius: 6,
                          background: `${C.purple}20`, border: `1px solid ${C.purple}40`,
                          color: C.purple, fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >Editar</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Tab: Referências */}
      {tab === 'references' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Galeria de Referências</div>
              <div style={{ fontSize: 12, color: C.textDim }}>Thumbnails, estilo visual e identidade do canal. O ThumbnailDirector usa estas referências.</div>
            </div>
            <button style={{
              background: C.purple, border: 'none', borderRadius: 8,
              padding: '8px 16px', color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              + Upload
            </button>
          </div>

          {references.length === 0 ? (
            <div style={{ background: C.card, border: `2px dashed ${C.border}`, borderRadius: 12, padding: '60px 40px', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🖼️</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Suba suas referências</div>
              <div style={{ fontSize: 13, color: C.textDim, maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
                Faça upload de thumbnails do seu canal, prints de estilo, paletas de cor.
                O ThumbnailDirector vai usar estas imagens pra manter consistência visual.
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
                <button style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 16px', color: C.text, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  📁 Escolher arquivos
                </button>
                <button style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 16px', color: C.text, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  🔗 Colar URL
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {references.map((url, i) => (
                <div key={i} style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}`, aspectRatio: '16/9' }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}

          {/* Brand colors */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Cores da Marca</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: '#ccc', border: `2px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer' }}>+</div>
              <div style={{ fontSize: 12, color: C.textDim }}>Adicione cores do seu canal pra manter consistência nas thumbnails</div>
            </div>
          </div>

          {/* Thumbnail style */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Estilo de Thumbnail</div>
            <textarea
              placeholder="Descreva o estilo das suas thumbnails (ex: close-up com texto grande à direita, fundo desfocado, cores vibrantes)"
              rows={3}
              style={{
                width: '100%', padding: '12px', borderRadius: 10,
                background: C.card, border: `1px solid ${C.border}`,
                color: C.text, fontSize: 13, fontFamily: 'inherit',
                resize: 'vertical', outline: 'none',
              }}
            />
          </div>
        </div>
      )}

      {/* Tab: Canais */}
      {tab === 'channels' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Canais Conectados</div>
            <button style={{
              background: C.purple, border: 'none', borderRadius: 8,
              padding: '8px 16px', color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              + Conectar Canal
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(PLATFORM_META).map(([id, meta]) => (
              <div key={id} style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: `${meta.color}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20,
                  }}>{meta.icon}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{meta.label}</div>
                    <div style={{ fontSize: 12, color: C.textDim }}>Não conectado</div>
                  </div>
                </div>
                <button style={{
                  background: `${meta.color}15`, border: `1px solid ${meta.color}30`,
                  borderRadius: 8, padding: '8px 16px',
                  color: meta.color, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  Conectar
                </button>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 20, padding: '14px', borderRadius: 10,
            background: `${C.purple}10`, border: `1px solid ${C.purple}20`,
            fontSize: 12, color: C.textDim, lineHeight: 1.6,
          }}>
            💡 Ao conectar seu canal, o Spielberg importa thumbnails, analisa performance e sugere conteúdo baseado nos seus dados reais.
          </div>
        </div>
      )}
    </div>
  )
}
