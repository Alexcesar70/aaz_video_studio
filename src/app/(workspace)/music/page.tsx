'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { C } from '@/components/studio/theme'

export default function MusicPage() {
  const router = useRouter()

  return (
    <div style={{ padding: '32px', color: C.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Música</h1>
      <p style={{ fontSize: 13, color: C.textDim, margin: '0 0 24px' }}>Crie cantigas, trilhas e efeitos sonoros com IA.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <button onClick={() => router.push('/studio')} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '32px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎵</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Cantigas</div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>Wizard de criação de músicas narrativas com IA</div>
        </button>
        <button onClick={() => router.push('/studio')} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '32px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Minha Biblioteca</div>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>Músicas geradas, favoritas e downloads</div>
        </button>
      </div>
    </div>
  )
}
