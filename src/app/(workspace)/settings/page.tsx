'use client'

import React, { useState, useEffect } from 'react'
import { C } from '@/components/studio/theme'
import { useWorkspace } from '../layout'

export default function SettingsPage() {
  const { user } = useWorkspace()
  const [wallet, setWallet] = useState<{ balance: number; totalTopUps: number; totalSpent: number } | null>(null)

  useEffect(() => {
    fetch('/api/me/wallet').then(r => r.ok ? r.json() : null).then(setWallet)
  }, [])

  const sections = [
    { title: 'Geral', desc: 'Nome, descrição e configurações básicas do workspace', icon: '⚙️' },
    { title: 'Branding', desc: 'Logo, cores e estilo visual padrão', icon: '🎨' },
    { title: 'Plano & Billing', desc: 'Plano atual, upgrade e faturas', icon: '💳' },
    { title: 'Integrações', desc: 'Webhooks, API keys e conexões externas', icon: '🔗' },
    { title: 'Notificações', desc: 'Preferências de email e in-app', icon: '🔔' },
    { title: 'Export & Backup', desc: 'Exportar todos os dados do workspace', icon: '📦' },
  ]

  return (
    <div style={{ padding: '32px', color: C.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Configurações</h1>
      <p style={{ fontSize: 13, color: C.textDim, margin: '0 0 24px' }}>
        {user?.workspaceName ?? 'Workspace'}
      </p>

      {/* Wallet summary */}
      {wallet && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px', marginBottom: 24, display: 'flex', gap: 32 }}>
          <div>
            <div style={{ fontSize: 12, color: C.textDim }}>Saldo</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.gold }}>${wallet.balance.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.textDim }}>Total recebido</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>${wallet.totalTopUps.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.textDim }}>Total gasto</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.red }}>${wallet.totalSpent.toFixed(2)}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {sections.map(s => (
          <div key={s.title} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px', cursor: 'pointer' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{s.title}</div>
            <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
