'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export interface WorkspaceUser {
  id: string
  email: string
  name: string
  role: 'super_admin' | 'admin' | 'creator'
  workspaceId?: string
  workspaceName?: string
  organizationId?: string
  permissions?: string[]
  products?: string[]
}

interface WorkspaceContextValue {
  user: WorkspaceUser | null
  loading: boolean
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  user: null,
  loading: true,
})

export function useWorkspace() {
  return useContext(WorkspaceContext)
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<WorkspaceUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setUser(data.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <WorkspaceContext.Provider value={{ user, loading }}>
      {children}
    </WorkspaceContext.Provider>
  )
}
