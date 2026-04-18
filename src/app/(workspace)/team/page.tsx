'use client'

import React, { useState, useEffect } from 'react'
import { C } from '@/components/studio/theme'
import { useWorkspace } from '@/lib/workspaceContext'

interface Member {
  id: string
  name: string
  email: string
  role: string
  status: string
  lastActiveAt?: string
}

export default function TeamPage() {
  const { user } = useWorkspace()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.ok ? r.json() : { users: [] })
      .then(data => setMembers(data.users ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: '32px', color: C.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Time</h1>
        {isAdmin && (
          <button style={{ background: C.purple, border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
            + Convidar
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: C.textDim }}>Carregando...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {members.map(m => (
            <div key={m.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: m.role === 'super_admin' || m.role === 'admin' ? C.gold : C.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#000' }}>
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: C.textDim }}>{m.email}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.5px',
                  padding: '3px 8px', borderRadius: 6,
                  background: m.role === 'super_admin' ? `${C.gold}20` : m.role === 'admin' ? `${C.blue}20` : `${C.purple}20`,
                  color: m.role === 'super_admin' ? C.gold : m.role === 'admin' ? C.blue : C.purple,
                  border: `1px solid ${m.role === 'super_admin' ? C.gold : m.role === 'admin' ? C.blue : C.purple}40`,
                }}>
                  {m.role.toUpperCase().replace('_', ' ')}
                </span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.status === 'active' ? C.green : C.red }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
