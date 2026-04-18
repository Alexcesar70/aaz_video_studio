'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { C } from '@/components/studio/theme'
import { useWorkspace } from '@/lib/workspaceContext'

export default function WorkspaceHome() {
  const router = useRouter()
  const { user } = useWorkspace()
  const [wallet, setWallet] = useState<{ balance: number; totalTopUps: number; totalSpent: number } | null>(null)
  const [stats, setStats] = useState({ projects: 0, characters: 0, scenes: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/me/wallet').then(r => r.ok ? r.json() : null),
      fetch('/api/assets').then(r => r.ok ? r.json() : null),
      fetch('/api/projects').then(r => r.ok ? r.json() : null),
      fetch('/api/scenes').then(r => r.ok ? r.json() : null),
    ]).then(([w, assets, projects, scenes]) => {
      if (w) setWallet({ balance: w.balance, totalTopUps: w.totalTopUps, totalSpent: w.totalSpent })
      setStats({
        projects: Array.isArray(projects) ? projects.length : 0,
        characters: assets?.assets?.filter((a: { type: string }) => a.type === 'character').length ?? 0,
        scenes: Array.isArray(scenes) ? scenes.length : 0,
      })
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: C.textDim }}>
        Carregando...
      </div>
    )
  }

  const quickActions = [
    { label: 'Abrir Estúdio', desc: 'Gerar vídeos e cenas', icon: '🎬', href: '/studio' },
    { label: 'Meus Assets', desc: 'Personagens, cenários e props', icon: '🎨', href: '/assets' },
    { label: 'Projetos', desc: 'Gerenciar projetos e episódios', icon: '📁', href: '/projects' },
    { label: 'Cantigas', desc: 'Criar músicas com IA', icon: '🎵', href: '/music' },
    { label: 'Vozes', desc: 'Design e clonagem de vozes', icon: '🎙', href: '/voices' },
    { label: 'Spaces', desc: 'Colaboração em equipe', icon: '🤝', href: '/spaces' },
  ]

  const statCards = [
    { label: 'Personagens', value: stats.characters, color: C.purple },
    { label: 'Projetos', value: stats.projects, color: C.blue },
    { label: 'Cenas', value: stats.scenes, color: C.green },
    { label: 'Saldo', value: `$${(wallet?.balance ?? 0).toFixed(2)}`, color: C.gold },
  ]

  return (
    <div style={{ padding: '32px', maxWidth: 960, color: C.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      {/* Welcome */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          Bem-vindo, {user?.name ?? 'Criador'}
        </h1>
        <p style={{ fontSize: 13, color: C.textDim, margin: '4px 0 0' }}>
          O que vamos criar hoje?
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px' }}>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Ações rápidas</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {quickActions.map(a => (
            <button
              key={a.label}
              onClick={() => router.push(a.href)}
              style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
                padding: '20px', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 16,
                transition: 'border-color 0.15s', fontFamily: 'inherit',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = C.purple)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
            >
              <span style={{ fontSize: 28 }}>{a.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{a.label}</div>
                <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{a.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
