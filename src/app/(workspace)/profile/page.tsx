'use client'

import React from 'react'
import { C } from '@/components/studio/theme'
import { useWorkspace } from '../layout'

export default function ProfilePage() {
  const { user } = useWorkspace()

  return (
    <div style={{ padding: '32px', color: C.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 24px' }}>Meu Perfil</h1>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '24px', maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#000' }}>
            {user?.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{user?.name ?? ''}</div>
            <div style={{ fontSize: 13, color: C.textDim }}>{user?.email ?? ''}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 4 }}>Role</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.role?.replace('_', ' ').toUpperCase() ?? ''}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 4 }}>Workspace</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.workspaceName ?? 'Sem workspace'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 4 }}>Workspace ID</div>
            <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace' }}>{user?.workspaceId ?? '—'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
