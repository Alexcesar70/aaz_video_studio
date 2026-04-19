'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { C } from '@/components/studio/theme'
import { WorkspaceProvider, useWorkspace } from '@/lib/workspaceContext'
import { NavIcons, DEFAULT_ICON_PROPS, type IconComponent } from '@/components/studio/workflow/theme/icons'

interface NavItem {
  href: string
  label: string
  Icon: IconComponent
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home', Icon: NavIcons.home },
  { href: '/studio', label: 'BearStudio', Icon: NavIcons.studio },
  { href: '/creators', label: 'Creators', Icon: NavIcons.creators },
  { href: '/projects', label: 'Projetos', Icon: NavIcons.projects },
  { href: '/assets', label: 'Assets', Icon: NavIcons.assets },
  { href: '/music', label: 'Música', Icon: NavIcons.music },
  { href: '/voices', label: 'Vozes', Icon: NavIcons.voices },
  { href: '/workflow', label: 'Workflow', Icon: NavIcons.workflow },
]

const BOTTOM_NAV: NavItem[] = [
  { href: '/team', label: 'Time', Icon: NavIcons.team },
  { href: '/settings', label: 'Config', Icon: NavIcons.settings },
  { href: '/profile', label: 'Perfil', Icon: NavIcons.profile },
]

/**
 * Rotas em que a sidebar global deve ficar compacta (só ícones) pra
 * liberar espaço de canvas/edição. Ex: boards do Workflow.
 */
const COMPACT_SIDEBAR_PATTERNS = [
  /^\/workflow\/[^/]+$/,
]

function isCompactRoute(pathname: string): boolean {
  return COMPACT_SIDEBAR_PATTERNS.some(pattern => pattern.test(pathname))
}

function Sidebar() {
  const { user } = useWorkspace()
  const pathname = usePathname()
  const router = useRouter()
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const compact = isCompactRoute(pathname)
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <nav style={{
      width: compact ? 52 : 200,
      background: C.surface,
      borderRight: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      transition: 'width 160ms ease',
    }}>
      <div style={{
        padding: compact ? '12px 8px' : '16px 16px 12px',
        borderBottom: `1px solid ${C.border}`,
        textAlign: compact ? 'center' : 'left',
      }}>
        {compact ? (
          <button
            onClick={() => router.push('/')}
            title={user?.workspaceName ?? 'Creative Studio'}
            style={{
              background: 'transparent', border: 'none', padding: 0,
              color: C.text, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <NavIcons.home size={18} {...DEFAULT_ICON_PROPS} />
          </button>
        ) : (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.workspaceName ?? 'Creative Studio'}
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
              {user?.name ?? ''}
            </div>
          </>
        )}
      </div>

      <div style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(item => {
          const active = isActive(item.href)
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              title={compact ? item.label : undefined}
              style={{
                display: 'flex', alignItems: 'center',
                gap: compact ? 0 : 10,
                justifyContent: compact ? 'center' : 'flex-start',
                padding: compact ? '8px 0' : '8px 12px',
                borderRadius: 8, border: 'none',
                background: active ? `${C.purple}20` : 'transparent',
                color: active ? C.text : C.textDim,
                cursor: 'pointer', fontSize: 13,
                fontWeight: active ? 600 : 400,
                fontFamily: 'inherit', textAlign: 'left',
                transition: 'all 0.1s',
              }}
            >
              <item.Icon size={16} {...DEFAULT_ICON_PROPS} />
              {!compact && item.label}
            </button>
          )
        })}
      </div>

      <div style={{ padding: '8px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {isAdmin && (
          <button
            onClick={() => router.push('/admin')}
            title={compact ? 'Admin' : undefined}
            style={{
              display: 'flex', alignItems: 'center',
              gap: compact ? 0 : 10,
              justifyContent: compact ? 'center' : 'flex-start',
              padding: compact ? '8px 0' : '8px 12px',
              borderRadius: 8, border: 'none',
              background: 'transparent', color: C.gold,
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit', textAlign: 'left',
            }}
          >
            <NavIcons.admin size={16} {...DEFAULT_ICON_PROPS} />
            {!compact && 'Admin'}
          </button>
        )}
        {BOTTOM_NAV.map(item => {
          const active = isActive(item.href)
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              title={compact ? item.label : undefined}
              style={{
                display: 'flex', alignItems: 'center',
                gap: compact ? 0 : 10,
                justifyContent: compact ? 'center' : 'flex-start',
                padding: compact ? '8px 0' : '8px 12px',
                borderRadius: 8, border: 'none',
                background: active ? `${C.purple}20` : 'transparent',
                color: active ? C.text : C.textDim,
                cursor: 'pointer', fontSize: 13,
                fontWeight: active ? 600 : 400,
                fontFamily: 'inherit', textAlign: 'left',
              }}
            >
              <item.Icon size={16} {...DEFAULT_ICON_PROPS} />
              {!compact && item.label}
            </button>
          )
        })}

        <button
          onClick={() => { fetch('/api/auth/logout', { method: 'POST' }); router.push('/login') }}
          title={compact ? 'Sair' : undefined}
          style={{
            display: 'flex', alignItems: 'center',
            gap: compact ? 0 : 10,
            justifyContent: compact ? 'center' : 'flex-start',
            padding: compact ? '8px 0' : '8px 12px',
            borderRadius: 8, border: 'none',
            background: 'transparent', color: C.textDim,
            cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
            textAlign: 'left', marginTop: 4,
          }}
        >
          <NavIcons.logout size={16} {...DEFAULT_ICON_PROPS} />
          {!compact && 'Sair'}
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
