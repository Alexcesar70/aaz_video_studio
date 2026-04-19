'use client'
import React, { useCallback, useMemo, useState } from 'react'
import { useWorkflow } from '../WorkflowContext'
import { NodeShell } from '../components/NodeShell'
import { NodeHeader } from '../components/NodeHeader'
import { NodeFrame } from '../components/NodeFrame'
import { SelectControl, type SelectOption } from '../components/controls/SelectControl'
import { standardNodeActions, downloadAction } from '../components/nodeActions'
import { useUpstreamText } from '../hooks/useUpstreamData'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { ActionIcons, NODE_TYPE_ICONS, DEFAULT_ICON_PROPS } from '../theme/icons'
import { wfColors, wfRadius } from '../theme/workflowTheme'
import type { NodeAction } from '../components/NodeActionsToolbar'

/**
 * Audio Node — geração de música via Suno. Recebe prompt (texto livre
 * ou letra dependendo do modo) e produz um clip de áudio.
 *
 * Input: text (upstream opcional — se conectado, usa em vez da textarea)
 * Output: any (URL do áudio, compatível com qualquer consumidor de mídia)
 *
 * Modos:
 *   song        — Suno interpreta o prompt como descrição musical
 *   lyrics      — Suno usa o texto como letra exata (customMode=true)
 *   instrumental — só música, sem vocal
 *
 * Backend: POST /api/generate-music (Suno API via proxy interno).
 */

const MODE_OPTIONS: SelectOption[] = [
  { value: 'song', label: 'Música' },
  { value: 'lyrics', label: 'Letra' },
  { value: 'instrumental', label: 'Instrumental' },
]

const STYLE_SUGGESTIONS: SelectOption[] = [
  { value: '', label: 'Estilo (opcional)' },
  { value: 'pop', label: 'Pop' },
  { value: 'acoustic', label: 'Acústico' },
  { value: 'lo-fi', label: 'Lo-fi' },
  { value: 'cinematic', label: 'Cinematográfico' },
  { value: 'electronic', label: 'Eletrônico' },
  { value: 'orchestral', label: 'Orquestral' },
  { value: 'ambient', label: 'Ambient' },
  { value: 'rock', label: 'Rock' },
]

export function AudioNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { updateNode, duplicateNode, deleteNode } = useWorkflow()
  const accent = (data.color as string) || getNodeTypeMeta('audio').color

  const mode = ((data.mode as string) ?? 'song') as 'song' | 'lyrics' | 'instrumental'
  const style = (data.style as string) ?? ''
  const title = (data.title as string) ?? ''
  const url = (data.url as string) ?? (data.musicUrl as string) ?? undefined

  const [localTitle, setLocalTitle] = useState(title)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Prompt vem SEMPRE de upstream (TextNode ou SmartPrompter conectado)
  const upstreamText = useUpstreamText(id)
  const effectivePrompt = (upstreamText ?? '').trim()
  const canRun = effectivePrompt.length > 0 && !generating

  const commitTitle = useCallback(() => {
    if (localTitle !== title) updateNode(id, { content: { title: localTitle } })
  }, [id, localTitle, title, updateNode])

  const patchContent = useCallback((patch: Record<string, unknown>) => {
    updateNode(id, { content: patch })
  }, [id, updateNode])

  const handleRun = useCallback(async () => {
    if (!canRun) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: effectivePrompt,
          title: localTitle || 'Sem título',
          style,
          customMode: mode === 'lyrics',
          instrumental: mode === 'instrumental',
        }),
      })
      const payload = await res.json() as {
        musicUrl?: string; duration?: number; error?: string
      }
      if (!res.ok) {
        setError(payload.error ?? 'Falha ao gerar áudio.')
        return
      }
      if (!payload.musicUrl) {
        setError('URL de áudio não retornada.')
        return
      }
      patchContent({
        url: payload.musicUrl,
        musicUrl: payload.musicUrl,
        duration: payload.duration,
      })
    } catch {
      setError('Erro de conexão.')
    } finally {
      setGenerating(false)
    }
  }, [canRun, effectivePrompt, localTitle, style, mode, patchContent])

  const actions: NodeAction[] = useMemo(() => [
    ...(downloadAction(url, `${localTitle || 'audio'}.mp3`) ? [downloadAction(url, `${localTitle || 'audio'}.mp3`)!] : []),
    ...standardNodeActions(id, { duplicateNode, deleteNode }),
  ], [id, url, localTitle, duplicateNode, deleteNode])

  return (
    <NodeFrame
      inputs={[{ dataType: 'text' }]}
      outputs={[{ dataType: 'any' }]}
      actions={actions}
    >
      <NodeShell
        type="audio"
        selected={selected}
        colorOverride={accent}
        width={300}
        glow={generating ? 'pulse' : undefined}
      >
        <NodeHeader
          type="audio"
          accent={accent}
          right={generating ? (
            <span style={{ fontSize: 10, color: accent }}>gerando…</span>
          ) : url ? (
            <span style={{ fontSize: 10, color: wfColors.textDim }}>
              {(data.duration as number) ? `${data.duration}s` : 'pronto'}
            </span>
          ) : undefined}
        />

        {/* Preview */}
        {url ? (
          <div style={{ marginBottom: 10 }}>
            <audio controls src={url} className="nodrag nowheel" style={{ width: '100%', height: 38 }} />
          </div>
        ) : (
          <div style={{
            height: 90, marginBottom: 10,
            background: wfColors.surfaceDeep,
            border: `1px dashed ${wfColors.border}`,
            borderRadius: wfRadius.inner,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {(() => {
              const I = NODE_TYPE_ICONS.audio
              return <I size={36} color={wfColors.textFaint} strokeWidth={1.25} />
            })()}
          </div>
        )}

        {/* Título opcional */}
        <input
          value={localTitle}
          onChange={e => setLocalTitle(e.target.value)}
          onBlur={commitTitle}
          placeholder="Título (opcional)"
          className="nodrag"
          style={{
            width: '100%', padding: '5px 8px', borderRadius: wfRadius.control,
            background: wfColors.surfaceDeep, border: `1px solid ${wfColors.border}`,
            color: wfColors.text, fontSize: 11, fontFamily: 'inherit', outline: 'none',
            marginBottom: 6,
          }}
        />

        {/* Hint quando faltam conexões */}
        {!upstreamText && (
          <div style={{
            fontSize: 10, color: wfColors.textFaint, textAlign: 'center', marginBottom: 8,
          }}>
            conecte um Texto ou Smart Prompter ←
          </div>
        )}

        {error && (
          <div style={{
            padding: '5px 8px', marginBottom: 8, borderRadius: wfRadius.control,
            background: '#ff5d7a15', border: '1px solid #ff5d7a30',
            fontSize: 10, color: '#ff5d7a',
          }}>
            {error}
          </div>
        )}

        {/* Controles */}
        <div className="nodrag" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          borderTop: `1px solid ${wfColors.border}`,
          paddingTop: 8,
        }}>
          <SelectControl
            options={MODE_OPTIONS}
            value={mode}
            onChange={v => patchContent({ mode: v })}
            minWidth={92}
          />
          <SelectControl
            options={STYLE_SUGGESTIONS}
            value={style}
            onChange={v => patchContent({ style: v })}
            minWidth={100}
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
