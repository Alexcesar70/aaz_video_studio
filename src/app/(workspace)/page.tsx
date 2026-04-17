'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { C } from '@/components/studio/theme'

interface DashboardData {
  user: {
    id: string
    name: string
    role: string
    workspaceName?: string
    organizationId?: string
  } | null
  wallet: {
    balance: number
    totalTopUps: number
    totalSpent: number
  } | null
  stats: {
    projects: number
    characters: number
    scenes: number
  }
}

export default function WorkspaceHome() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.ok ? r.json() : null),
      fetch('/api/me/wallet').then(r => r.ok ? r.json() : null),
      fetch('/api/assets').then(r => r.ok ? r.json() : null),
      fetch('/api/projects').then(r => r.ok ? r.json() : null),
      fetch('/api/scenes').then(r => r.ok ? r.json() : null),
    ]).then(([me, wallet, assets, projects, scenes]) => {
      setData({
        user: me?.user ?? null,
        wallet: wallet ? { balance: wallet.balance, totalTopUps: wallet.totalTopUps, totalSpent: wallet.totalSpent } : null,
        stats: {
          projects: Array.isArray(projects) ? projects.length : 0,
          characters: assets?.assets?.filter((a: { type: string }) => a.type === 'character').length ?? 0,
          scenes: Array.isArray(scenes) ? scenes.length : 0,
        },
      })
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.textDim, fontSize: 14 }}>Carregando...</div>
      </div>
    )
  }

  const workspaceName = data?.user?.workspaceName ?? 'Creative Studio'
  const isAdmin = data?.user?.role === 'admin' || data?.user?.role === 'super_admin'

  const quickActions = [
    { label: 'Abrir Estúdio', desc: 'Gerar vídeos e cenas', icon: '🎬', href: '/studio' },
    { label: 'Meus Assets', desc: 'Personagens, cenários e props', icon: '🎨', href: '/studio', tab: 'library' },
    { label: 'Cantigas', desc: 'Criar músicas com IA', icon: '🎵', href: '/studio', tab: 'cantigas' },
    { label: 'Vozes', desc: 'Design e clonagem de vozes', icon: '🎙', href: '/studio', tab: 'senoide' },
  ]

  const statCards = [
    { label: 'Personagens', value: data?.stats.characters ?? 0, color: C.purple },
    { label: 'Projetos', value: data?.stats.projects ?? 0, color: C.blue },
    { label: 'Cenas', value: data?.stats.scenes ?? 0, color: C.green },
    { label: 'Saldo', value: `$${(data?.wallet?.balance ?? 0).toFixed(2)}`, color: C.gold },
  ]

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text }}>{workspaceName}</div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>Bem-vindo, {data?.user?.name ?? 'Criador'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <a href="/admin" style={{ background: `${C.gold}15`, border: `1px solid ${C.gold}40`, borderRadius: 8, padding: '8px 16px', textDecoration: 'none', fontSize: 12, fontWeight: 600, color: C.gold }}>
              Painel Admin
            </a>
          )}
          <button
            onClick={() => { fetch('/api/auth/logout', { method: 'POST' }); router.push('/login') }}
            style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 16px', cursor: 'pointer', color: C.textDim, fontSize: 12, fontFamily: 'inherit' }}
          >
            Sair
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
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
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>Ações rápidas</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {quickActions.map(a => (
              <button
                key={a.label}
                onClick={() => router.push(a.href)}
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: '20px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  transition: 'border-color 0.15s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = C.purple)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
              >
                <span style={{ fontSize: 32 }}>{a.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{a.label}</div>
                  <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{a.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
