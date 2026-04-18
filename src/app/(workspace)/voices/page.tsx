'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { C } from '@/components/studio/theme'

export default function VoicesPage() {
  const router = useRouter()

  const sections = [
    { icon: '🗣', title: 'Designer de Voz', desc: 'Crie vozes únicas descrevendo personalidade e timbre', href: '/studio' },
    { icon: '🎭', title: 'Diálogos', desc: 'Gere diálogos com TTS pra episódios', href: '/studio' },
    { icon: '🌍', title: 'Poliglota', desc: 'Traduza e gere áudio em outros idiomas', href: '/studio' },
    { icon: '🔬', title: 'Clonar Voz', desc: 'Upload de sample → clone personalizado', href: '/studio' },
  ]

  return (
    <div style={{ padding: '32px', color: C.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Vozes</h1>
      <p style={{ fontSize: 13, color: C.textDim, margin: '0 0 24px' }}>Design, clonagem e gestão de vozes pra personagens.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {sections.map(s => (
          <button key={s.title} onClick={() => router.push(s.href)} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '32px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{s.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{s.title}</div>
            <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>{s.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
