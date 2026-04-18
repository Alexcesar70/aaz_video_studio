'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { C } from '@/components/studio/theme'
import { useWorkspace } from '@/lib/workspaceContext'

interface Project {
  id: string
  name: string
  createdAt: string
  organizationId?: string
}

export default function ProjectsPage() {
  const router = useRouter()
  const { user } = useWorkspace()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.ok ? r.json() : [])
      .then(data => setProjects(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: '32px', color: C.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Projetos</h1>
        <button
          onClick={() => {/* TODO: create project modal */}}
          style={{ background: C.purple, border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
        >
          + Novo Projeto
        </button>
      </div>

      {loading ? (
        <div style={{ color: C.textDim }}>Carregando...</div>
      ) : projects.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📁</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Nenhum projeto ainda</div>
          <div style={{ fontSize: 13, color: C.textDim }}>Crie seu primeiro projeto pra organizar episódios e cenas.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {projects.map(p => (
            <div key={p.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px', cursor: 'pointer' }}
              onClick={() => {/* TODO: navigate to project detail */}}
            >
              <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>
                {new Date(p.createdAt).toLocaleDateString('pt-BR')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
