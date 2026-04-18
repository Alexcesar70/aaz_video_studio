'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { C } from '@/components/studio/theme'
import { WorkspaceProvider, useWorkspace } from '@/lib/workspaceContext'

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/studio', label: 'BearStudio', icon: '🎬' },
  { href: '/creators', label: 'Creators', icon: '🎯' },
  { href: '/projects', label: 'Projetos', icon: '📁' },
  { href: '/assets', label: 'Assets', icon: '🎨' },
  { href: '/music', label: 'Música', icon: '🎵' },
  { href: '/voices', label: 'Vozes', icon: '🎙' },
  { href: '/spaces', label: 'Workflow', icon: '🔄' },
]

const BOTTOM_NAV = [
  { href: '/team', label: 'Time', icon: '👥' },
  { href: '/settings', label: 'Config', icon: '⚙️' },
  { href: '/profile', label: 'Perfil', icon: '👤' },
]

function Sidebar() {
  const { user } = useWorkspace()
  const pathname = usePathname()
  const router = useRouter()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <nav style={{
      width: 200,
      background: C.surface,
      borderRight: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user?.workspaceName ?? 'Creative Studio'}
        </div>
        <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
          {user?.name ?? ''}
        </div>
      </div>

      <div style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 8, border: 'none',
              background: isActive(item.href) ? `${C.purple}20` : 'transparent',
              color: isActive(item.href) ? C.text : C.textDim,
              cursor: 'pointer', fontSize: 13,
              fontWeight: isActive(item.href) ? 600 : 400,
              fontFamily: 'inherit', textAlign: 'left',
              transition: 'all 0.1s',
            }}
          >
            <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '8px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {isAdmin && (
          <button
            onClick={() => router.push('/admin')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 8, border: 'none',
              background: 'transparent', color: C.gold,
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>👑</span>
            Admin
          </button>
        )}
        {BOTTOM_NAV.map(item => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 8, border: 'none',
              background: isActive(item.href) ? `${C.purple}20` : 'transparent',
              color: isActive(item.href) ? C.text : C.textDim,
              cursor: 'pointer', fontSize: 13,
              fontWeight: isActive(item.href) ? 600 : 400,
              fontFamily: 'inherit', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
            {item.label}
          </button>
        ))}

        <button
          onClick={() => { fetch('/api/auth/logout', { method: 'POST' }); router.push('/login') }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 8, border: 'none',
            background: 'transparent', color: C.textDim,
            cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
            textAlign: 'left', marginTop: 4,
          }}
        >
          <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>🚪</span>
          Sair
        </button>
      </div>
    </nav>
  )
}

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
        <Sidebar />
        <main style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </WorkspaceProvider>
  )
}
