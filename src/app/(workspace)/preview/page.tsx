'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { C } from '@/components/studio/theme'
import { SequentialPlayer, type PlayerScene } from '@/components/studio/VideoPlayer'

export default function PreviewPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', color: C.textDim }}>Carregando preview...</div>}>
      <PreviewContent />
    </Suspense>
  )
}

function PreviewContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const episodeId = searchParams.get('episode')
  const [scenes, setScenes] = useState<PlayerScene[]>([])
  const [episodeName, setEpisodeName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!episodeId) {
      fetch('/api/scenes')
        .then(r => r.ok ? r.json() : [])
        .then((data: Array<{ id: string; title?: string; prompt?: string; videoUrl?: string; duration?: number; status?: string }>) => {
          const arr = Array.isArray(data) ? data : []
          setScenes(arr.filter(s => s.videoUrl).map(s => ({
            id: s.id,
            title: s.title ?? s.prompt?.slice(0, 40) ?? 'Cena',
            videoUrl: s.videoUrl ?? '',
            duration: s.duration ?? 5,
            status: (s.status as PlayerScene['status']) ?? 'ready',
          })))
          setEpisodeName('Todas as cenas')
        })
        .finally(() => setLoading(false))
      return
    }

    Promise.all([
      fetch(`/api/scenes?episodeId=${episodeId}`).then(r => r.ok ? r.json() : []),
      fetch('/api/episodes').then(r => r.ok ? r.json() : []),
    ]).then(([scenesData, episodesData]) => {
      const arr = Array.isArray(scenesData) ? scenesData : []
      setScenes(arr.map((s: { id: string; title?: string; prompt?: string; videoUrl?: string; duration?: number; status?: string; sceneNumber?: number }) => ({
        id: s.id,
        title: s.title ?? `Cena ${s.sceneNumber ?? ''}`,
        videoUrl: s.videoUrl ?? '',
        duration: s.duration ?? 5,
        status: (s.status as PlayerScene['status']) ?? (s.videoUrl ? 'ready' : 'pending'),
      })))
      const ep = Array.isArray(episodesData) ? episodesData.find((e: { id: string }) => e.id === episodeId) : null
      setEpisodeName(ep?.name ?? 'Episódio')
    }).finally(() => setLoading(false))
  }, [episodeId])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', color: C.textDim }}>
        Carregando preview...
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 32px', color: C.text, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', padding: 0, marginBottom: 4, display: 'block' }}>
            ← Voltar
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Preview · {episodeName}</h1>
          <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{scenes.length} cenas · {scenes.reduce((s, c) => s + c.duration, 0)}s total</div>
        </div>
      </div>

      <SequentialPlayer
        scenes={scenes}
        onOpenInEditor={(scene) => router.push(`/studio`)}
        showControls
      />
    </div>
  )
}
