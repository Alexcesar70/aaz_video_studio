'use client'

/**
 * HistoryTab — aba "Cenas" do AAZ Studio. Renderiza o histórico
 * agrupado por Project → Episode → Scenes, com episódios avulsos
 * e cenas órfãs em seções separadas.
 *
 * Extraído de AAZStudio.tsx (M5-PR6). Sem state interno — recebe
 * tudo via props do componente parent.
 */

import React from 'react'
import { C } from '../theme'
import type {
  CurrentUser,
  SceneAsset,
  SceneStatus,
  Project,
  Episode,
} from '../types'
import { SceneCard } from '../widgets/SceneCard'
import { EpisodeHeader } from '../widgets/EpisodeHeader'
import { EpisodeDeliveryCard } from '../widgets/EpisodeDeliveryCard'

export interface HistoryTabProps {
  scenes: SceneAsset[]
  projects: Project[]
  episodes: Episode[]
  currentUser: CurrentUser | null
  onPlay: (scene: SceneAsset) => void
  onDownload: (url: string, filename: string) => void
  onDelete: (id: string) => void
  onMoveScene: (scene: SceneAsset) => void
  onMoveEpisode: (episode: Episode) => void
  onDeleteEpisode: (episode: Episode) => void
  onPlayEpisodeSequential: (episode: Episode) => void
  onPlayProjectSequential: (project: Project) => void
  onSetSceneStatus: (sceneId: string, status: SceneStatus) => void
  onRenameEpisode: (episodeId: string, newName: string) => void
  onOpenDelivery: (episode: Episode) => void
}

export function HistoryTab({
  scenes,
  projects,
  episodes,
  onPlay,
  onDownload,
  onDelete,
  onMoveScene,
  onMoveEpisode,
  onDeleteEpisode,
  onPlayEpisodeSequential,
  onPlayProjectSequential,
  onSetSceneStatus,
  onRenameEpisode,
  onOpenDelivery,
}: HistoryTabProps) {
  const total = scenes.length
  const orphans = scenes.filter((s) => !s.episodeId)
  const episodesWithScenes = episodes.filter((ep) =>
    scenes.some((s) => s.episodeId === ep.id),
  )
  const projectsWithContent = projects.filter((p) =>
    episodesWithScenes.some((ep) => ep.projectId === p.id),
  )
  const standaloneEpisodes = episodesWithScenes.filter((ep) => !ep.projectId)

  const sceneGrid = (arr: SceneAsset[]) => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))',
        gap: 14,
      }}
    >
      {arr.map((s) => (
        <SceneCard
          key={s.id}
          scene={s}
          onPlay={onPlay}
          onDownload={onDownload}
          onDelete={onDelete}
          onMoveScene={onMoveScene}
          onSetStatus={onSetSceneStatus}
        />
      ))}
    </div>
  )

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 18,
          marginTop: 4,
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>
          🎬 Cenas ({total})
        </h1>
      </div>

      {total === 0 ? (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: '48px',
            textAlign: 'center',
            color: C.textDim,
          }}
        >
          <div style={{ fontSize: 42, marginBottom: 10 }}>🎬</div>
          <div style={{ fontSize: 14 }}>
            Nenhuma cena gerada ainda. Volte ao Estúdio e crie a primeira.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* Projetos */}
          {projectsWithContent.map((proj) => {
            const projEps = episodesWithScenes.filter(
              (ep) => ep.projectId === proj.id,
            )
            const projScenesCount = scenes.filter((s) =>
              projEps.some((e) => e.id === s.episodeId),
            ).length
            return (
              <section key={proj.id}>
                <div
                  style={{
                    background: `linear-gradient(135deg, ${C.purple}14, ${C.purple}06)`,
                    border: `1px solid ${C.purple}40`,
                    borderRadius: 12,
                    padding: '16px 20px',
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <h2
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: C.text,
                        margin: 0,
                      }}
                    >
                      📁 {proj.name}
                    </h2>
                    <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>
                      {projEps.length} episódio{projEps.length !== 1 ? 's' : ''} ·{' '}
                      {projScenesCount} cena{projScenesCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {projScenesCount >= 2 && (
                    <button
                      onClick={() => onPlayProjectSequential(proj)}
                      title="Assistir todas as cenas do projeto em sequência"
                      style={{
                        background: C.purple,
                        border: `1px solid ${C.purple}`,
                        borderRadius: 10,
                        padding: '10px 20px',
                        cursor: 'pointer',
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 700,
                        fontFamily: 'inherit',
                        boxShadow: `0 4px 14px ${C.purple}40`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ▶ Assistir projeto inteiro
                    </button>
                  )}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 18,
                    paddingLeft: 12,
                    borderLeft: `2px solid ${C.border}`,
                  }}
                >
                  {projEps.map((ep) => {
                    const epScenes = scenes.filter((s) => s.episodeId === ep.id)
                    return (
                      <div key={ep.id}>
                        <div style={{ marginLeft: 8 }}>
                          <EpisodeHeader
                            episode={ep}
                            count={epScenes.length}
                            onMove={onMoveEpisode}
                            onDelete={onDeleteEpisode}
                            onPlaySequential={onPlayEpisodeSequential}
                            onRename={onRenameEpisode}
                          />
                        </div>
                        <div style={{ marginLeft: 8 }}>{sceneGrid(epScenes)}</div>
                        <div style={{ marginLeft: 8 }}>
                          <EpisodeDeliveryCard episode={ep} onOpen={onOpenDelivery} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}

          {/* Episódios avulsos */}
          {standaloneEpisodes.length > 0 && (
            <section>
              <h2
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: C.text,
                  margin: 0,
                  marginBottom: 12,
                }}
              >
                🎬 Episódios Avulsos
              </h2>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
              >
                {standaloneEpisodes.map((ep) => {
                  const epScenes = scenes.filter((s) => s.episodeId === ep.id)
                  return (
                    <div key={ep.id}>
                      <EpisodeHeader
                        episode={ep}
                        count={epScenes.length}
                        onMove={onMoveEpisode}
                        onDelete={onDeleteEpisode}
                        onPlaySequential={onPlayEpisodeSequential}
                        onRename={onRenameEpisode}
                      />
                      {sceneGrid(epScenes)}
                      <EpisodeDeliveryCard episode={ep} onOpen={onOpenDelivery} />
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Cenas órfãs (sem episódio) */}
          {orphans.length > 0 && (
            <section>
              <h2
                style={{
                  fontSize: 17,
                  fontWeight: 700,
                  color: C.text,
                  margin: 0,
                  marginBottom: 4,
                }}
              >
                🎞 Cenas sem episódio
              </h2>
              <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>
                Cenas geradas sem um episódio selecionado
              </div>
              {sceneGrid(orphans)}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
