'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWorkflow } from '../WorkflowContext'
import { NodeShell } from '../components/NodeShell'
import { NodeHeader } from '../components/NodeHeader'
import { NodeFrame } from '../components/NodeFrame'
import { OutputsGrid } from '../components/OutputsGrid'
import { SelectControl, type SelectOption } from '../components/controls/SelectControl'
import { UploadControl } from '../components/controls/UploadControl'
import { standardNodeActions, downloadAction } from '../components/nodeActions'
import { useUpstreamText, useUpstreamImage, useUpstreamVideo } from '../hooks/useUpstreamData'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { ActionIcons, NODE_TYPE_ICONS, DEFAULT_ICON_PROPS } from '../theme/icons'
import { wfColors, wfRadius } from '../theme/workflowTheme'
import type { NodeAction } from '../components/NodeActionsToolbar'
import { VIDEO_ENGINES, DEFAULT_ENGINE_ID, getEngine } from '@/lib/videoEngines'

/**
 * Video Generator — equivalente ao Image Generator mas pra vídeo.
 * Suporta os 3 padrões do Freepik:
 *
 *  - Texto puro  (prompt → vídeo)
 *  - Image-to-video (imagem start + prompt → vídeo)
 *  - Video-to-video (vídeo ref + prompt → vídeo reinterpretado)
 *
 * Inputs laterais (esquerda, empilhados):
 *   text  — prompt conectado do TextNode/SmartPrompter
 *   image — start frame / ref image (ImageGenerator/Character/Scenario)
 *   video — ref video (outro VideoGenerator)
 *
 * Pode também usar textarea interna + upload manual quando não há
 * conexão upstream.
 *
 * Backend: POST /api/generate (assíncrono, retorna jobId) + polling
 * em GET /api/jobs/[id] até completed/failed.
 */

const ASPECT_OPTIONS: SelectOption[] = [
  { value: '16:9', label: '16:9', hint: 'Wide' },
  { value: '9:16', label: '9:16', hint: 'Stories' },
  { value: '1:1', label: '1:1', hint: 'Quadrado' },
  { value: '4:3', label: '4:3', hint: 'Clássico' },
  { value: '3:4', label: '3:4', hint: 'Retrato' },
  { value: '21:9', label: '21:9', hint: 'Ultra-wide' },
]

interface StoredOutput { url: string }

export function VideoNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { updateNode, duplicateNode, deleteNode } = useWorkflow()
  const accent = (data.color as string) || getNodeTypeMeta('video').color

  // Estado persistido
  const modelId = (data.modelId as string) ?? DEFAULT_ENGINE_ID
  const aspectRatio = (data.aspectRatio as string) ?? '16:9'
  const duration = (data.duration as number) ?? 5
  const firstFrameUrl = (data.firstFrameUrl as string) ?? undefined
  const lastFrameUrl = (data.lastFrameUrl as string) ?? undefined

  const legacyUrl = data.url as string | undefined
  const persistedOutputs: StoredOutput[] = (data.outputs as StoredOutput[] | undefined)
    ?? (legacyUrl ? [{ url: legacyUrl }] : [])
  const selectedIndex = typeof data.selectedIndex === 'number' ? data.selectedIndex : 0

  // Sem textarea local — prompt vem SEMPRE de upstream (TextNode/SmartPrompter)
  const [jobId, setJobId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Upstream (reativo)
  const upstreamText = useUpstreamText(id)
  const upstreamImage = useUpstreamImage(id)
  const upstreamVideo = useUpstreamVideo(id)

  const effectivePrompt = (upstreamText ?? '').trim()
  const effectiveFirstFrame = firstFrameUrl ?? upstreamImage ?? undefined
  const referenceVideoUrl = (data.referenceVideoUrl as string) ?? undefined
  const effectiveRefVideo = upstreamVideo ?? referenceVideoUrl
  const canRun = effectivePrompt.length > 0 && !generating

  const engine = useMemo(() => getEngine(modelId), [modelId])

  const modelOptions: SelectOption[] = useMemo(
    () => VIDEO_ENGINES.map(e => ({ value: e.id, label: e.name })),
    [],
  )

  // Aspect ratios válidos pra engine atual
  const aspectOptions = useMemo(
    () => ASPECT_OPTIONS.filter(o => engine.aspectRatios.includes(o.value)),
    [engine],
  )
  const durationOptions: SelectOption[] = useMemo(
    () => engine.durations.map(d => ({ value: String(d), label: `${d}s` })),
    [engine],
  )

  const patchContent = useCallback((patch: Record<string, unknown>) => {
    updateNode(id, { content: patch })
  }, [id, updateNode])

  // ─── Polling do job ──────────────────────────────────────────
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!jobId || !generating) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`)
        if (!res.ok) return
        const payload = await res.json() as {
          job?: { status: string; output?: { videoUrl?: string }; error?: { message?: string } }
        }
        const job = payload.job
        if (!job) return
        if (job.status === 'completed' && job.output?.videoUrl) {
          const url = job.output.videoUrl
          patchContent({
            outputs: [{ url }],
            selectedIndex: 0,
            url,
          })
          setGenerating(false)
          setJobId(null)
        } else if (job.status === 'failed') {
          setError(job.error?.message ?? 'Falha ao gerar vídeo.')
          setGenerating(false)
          setJobId(null)
        }
      } catch {
        // silent — tenta de novo no próximo tick
      }
    }

    pollingRef.current = setInterval(poll, 2000)
    // Chama uma vez imediato também
    poll()
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [jobId, generating, patchContent])

  const handleRun = useCallback(async () => {
    if (!canRun) return
    setGenerating(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        prompt: effectivePrompt,
        engineId: modelId,
        aspect_ratio: aspectRatio,
        duration,
      }
      if (effectiveFirstFrame) body.first_frame_url = effectiveFirstFrame
      if (lastFrameUrl) body.last_frame_url = lastFrameUrl
      if (effectiveRefVideo) body.reference_videos = [effectiveRefVideo]

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await res.json() as {
        jobId?: string; async?: boolean; videoUrl?: string; error?: string
      }

      if (!res.ok) {
        setError(payload.error ?? 'Falha ao gerar vídeo.')
        setGenerating(false)
        return
      }

      // Modo síncrono (flag USE_ASYNC_GENERATION desligada) — response já traz videoUrl
      if (!payload.async && payload.videoUrl) {
        patchContent({
          outputs: [{ url: payload.videoUrl }],
          selectedIndex: 0,
          url: payload.videoUrl,
        })
        setGenerating(false)
        return
      }

      // Modo async — polling via jobId
      if (payload.jobId) {
        setJobId(payload.jobId)
        return
      }

      setError('Response inesperada do servidor.')
      setGenerating(false)
    } catch {
      setError('Erro de conexão.')
      setGenerating(false)
    }
  }, [canRun, effectivePrompt, modelId, aspectRatio, duration, effectiveFirstFrame, lastFrameUrl, effectiveRefVideo, patchContent])

  const handleSelectOutput = useCallback((idx: number) => {
    patchContent({ selectedIndex: idx, url: persistedOutputs[idx]?.url })
  }, [patchContent, persistedOutputs])

  const handleDeleteOutput = useCallback((idx: number) => {
    const next = persistedOutputs.filter((_, i) => i !== idx)
    const nextSelected = Math.min(selectedIndex, Math.max(0, next.length - 1))
    patchContent({
      outputs: next,
      selectedIndex: next.length > 0 ? nextSelected : 0,
      url: next[nextSelected]?.url,
    })
  }, [persistedOutputs, selectedIndex, patchContent])

  const selectedUrl = persistedOutputs[selectedIndex]?.url ?? legacyUrl

  const actions: NodeAction[] = useMemo(() => [
    ...(downloadAction(selectedUrl, 'video.mp4') ? [downloadAction(selectedUrl, 'video.mp4')!] : []),
    ...standardNodeActions(id, { duplicateNode, deleteNode }),
  ], [id, selectedUrl, duplicateNode, deleteNode])

  const cellAspect = aspectRatio.replace(':', ' / ')
  const hasOutputs = persistedOutputs.length > 0

  return (
    <NodeFrame
      inputs={[
        { dataType: 'text', id: 'prompt' },
        { dataType: 'image', id: 'frame' },
        { dataType: 'video', id: 'ref' },
      ]}
      outputs={[{ dataType: 'video' }]}
      actions={actions}
    >
      <NodeShell
        type="video"
        selected={selected}
        colorOverride={accent}
        width={310}
        flush
        glow={generating ? 'pulse' : undefined}
      >
        <div style={{ padding: '10px 12px 2px' }}>
          <NodeHeader
            type="video"
            accent={accent}
            right={generating ? (
              <span style={{ fontSize: 10, color: accent }}>
                {jobId ? 'processando…' : 'gerando…'}
              </span>
            ) : hasOutputs ? (
              <span style={{ fontSize: 10, color: wfColors.textDim }}>
                {duration}s · {engine.name}
              </span>
            ) : undefined}
          />
        </div>

        {/* Preview area */}
        <div style={{ padding: '0 12px', marginBottom: 8 }}>
          {hasOutputs ? (
            <OutputsGrid
              outputs={persistedOutputs}
              selectedIndex={selectedIndex}
              onSelect={handleSelectOutput}
              onDelete={handleDeleteOutput}
              cellAspect={cellAspect}
              accent={accent}
              isVideo
            />
          ) : (
            <div style={{
              aspectRatio: cellAspect,
              background: wfColors.surfaceDeep,
              border: `1px dashed ${wfColors.border}`,
              borderRadius: wfRadius.control,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {(() => {
                const I = NODE_TYPE_ICONS.video
                return <I size={28} color={wfColors.textFaint} strokeWidth={1.25} />
              })()}
            </div>
          )}
        </div>

        {/* Hint quando faltam conexões — micro, sem ocupar muito espaço */}
        {!upstreamText && (
          <div style={{
            padding: '0 12px 6px',
            fontSize: 10, color: wfColors.textFaint, textAlign: 'center',
          }}>
            conecte um Texto ou Smart Prompter ←
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            margin: '0 12px 8px',
            padding: '5px 8px', borderRadius: wfRadius.control,
            background: '#ff5d7a15', border: '1px solid #ff5d7a30',
            fontSize: 10, color: '#ff5d7a',
          }}>
            {error}
          </div>
        )}

        {/* Controles inferiores */}
        <div className="nodrag" style={{
          padding: '8px 12px 10px',
          borderTop: `1px solid ${wfColors.border}`,
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          <SelectControl
            options={modelOptions}
            value={modelId}
            onChange={v => patchContent({ modelId: v })}
            minWidth={130}
          />
          <SelectControl
            options={aspectOptions}
            value={aspectRatio}
            onChange={v => patchContent({ aspectRatio: v })}
            minWidth={60}
          />
          <SelectControl
            options={durationOptions}
            value={String(duration)}
            onChange={v => patchContent({ duration: Number(v) })}
            minWidth={55}
          />
          <UploadControl
            accept="image/*"
            onUploaded={url => patchContent({ firstFrameUrl: url })}
            hasValue={!!firstFrameUrl}
            accent={accent}
            disabled={generating}
            title={firstFrameUrl ? 'Start frame anexado (clique pra trocar)' : 'Anexar imagem como start frame'}
          />
          <UploadControl
            accept="video/*"
            onUploaded={url => patchContent({ referenceVideoUrl: url })}
            hasValue={!!(data.referenceVideoUrl as string | undefined)}
            accent={accent}
            disabled={generating}
            title={(data.referenceVideoUrl as string | undefined)
              ? 'Vídeo de referência anexado (clique pra trocar)'
              : 'Anexar vídeo de referência (video-to-video)'}
          />
          <button
            onClick={() => void handleRun()}
            disabled={!canRun}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex', alignItems: 'center', gap: 5,
              height: 22, padding: '0 10px',
              background: canRun ? accent : wfColors.border,
              border: 'none', borderRadius: wfRadius.control,
              color: canRun ? '#0A0814' : wfColors.textFaint,
              fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
              cursor: canRun ? 'pointer' : 'default',
            }}
          >
            <ActionIcons.run size={9} {...DEFAULT_ICON_PROPS} />
            {generating ? 'Gerando…' : 'Gerar'}
          </button>
        </div>
      </NodeShell>
    </NodeFrame>
  )
}

