'use client'

import React from 'react'
import { C } from '@/components/studio/theme'
import { useWorkspace } from '@/lib/workspaceContext'

export default function SpacesPage() {
  const { user } = useWorkspace()

  return (
    <div style={{ padding: '32px', color: C.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>Spaces</h1>
      <p style={{ fontSize: 13, color: C.textDim, margin: '0 0 24px' }}>
        Colaboração visual em equipe — boards, comentários e atribuições.
      </p>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '60px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🤝</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Em breve</div>
        <div style={{ fontSize: 13, color: C.textDim, maxWidth: 400, margin: '0 auto' }}>
          Boards colaborativos inspirados no Figma e Freepik Spaces.
          Organize assets, cenas e episódios em canvas visual com nós conectáveis.
        </div>
      </div>
    </div>
  )
}
