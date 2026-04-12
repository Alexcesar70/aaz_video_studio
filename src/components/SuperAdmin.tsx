'use client'

import React, { useState, useEffect, useCallback } from 'react'

const C = {
  bg: '#13131a', surface: '#1a1a24', card: '#22222e', border: '#2e2e3e',
  borderHi: '#3a3a4e', gold: '#C9A84C', blue: '#5B8DEF', green: '#4ADE80',
  red: '#F87171', purple: '#A78BFA', text: '#E8E8F0', textDim: '#9898B0',
}

type View = 'dashboard' | 'orgs' | 'plans' | 'users' | 'financial'

// ── Placeholder views (will be replaced) ──
function DashboardView() { return <div style={{ color: C.textDim }}>Carregando...</div> }
function OrgsView() { return <div style={{ color: C.textDim }}>Carregando...</div> }
function PlansView() { return <div style={{ color: C.textDim }}>Carregando...</div> }
function UsersView() { return <div style={{ color: C.textDim }}>Carregando...</div> }
function FinancialView() { return <div style={{ color: C.textDim }}>Carregando...</div> }

const NAV: { id: View; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'orgs', label: 'Organizações', icon: '🏢' },
  { id: 'plans', label: 'Planos', icon: '📋' },
  { id: 'users', label: 'Usuários', icon: '👥' },
  { id: 'financial', label: 'Financeiro', icon: '💰' },
]

export function SuperAdmin() {
  const [view, setView] = useState<View>('dashboard')

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: C.surface, borderRight: `1px solid ${C.border}`, padding: '20px 0', flexShrink: 0 }}>
        <div style={{ padding: '0 20px 20px', borderBottom: `1px solid ${C.border}`, marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.gold }}>AAZ Platform</div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>Super Admin</div>
        </div>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setView(n.id)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 20px',
            background: view === n.id ? C.card : 'transparent', border: 'none', borderLeft: view === n.id ? `3px solid ${C.gold}` : '3px solid transparent',
            cursor: 'pointer', color: view === n.id ? C.text : C.textDim, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', textAlign: 'left',
          }}>
            <span>{n.icon}</span><span>{n.label}</span>
          </button>
        ))}
        <div style={{ padding: '16px 20px', marginTop: 'auto', borderTop: `1px solid ${C.border}`, position: 'absolute', bottom: 0, width: 220 }}>
          <a href="/studio" style={{ color: C.blue, fontSize: 12, textDecoration: 'none' }}>← Voltar ao Studio</a>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: 28, overflowY: 'auto', maxHeight: '100vh' }}>
        {view === 'dashboard' && <DashboardView />}
        {view === 'orgs' && <OrgsView />}
        {view === 'plans' && <PlansView />}
        {view === 'users' && <UsersView />}
        {view === 'financial' && <FinancialView />}
      </div>
    </div>
  )
}
