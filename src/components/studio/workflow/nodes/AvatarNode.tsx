'use client'

/**
 * Avatar Node — gera vídeo de avatar falante usando Character da
 * biblioteca (AAZ pattern: múltiplas refs + descrição canônica =
 * identidade travada no Seedance).
 *
 * Difere do VideoNode genérico:
 *   - VideoNode: gera vídeo puro (text-to-video, image-to-video,
 *     video-to-video) com uma foto solta como ref → fidelidade fraca
 *   - AvatarNode: usa Character (slug, até 3 refs curadas + descrição
 *     canônica em promptBlock/description) → fidelidade alta
 *
 * Inputs:
 *   text — upstream opcional pra script (Prompt/Texto/Assistant)
 * Outputs:
 *   video — URL do vídeo gerado
 *
 * Persistência: characterId (slug), script, aspect, duration, videoUrl.
 * CharacterPicker busca /api/assets?type=character (lead + custom).
 *
 * Backend: /api/generate com payload Seedance + refImages resolvidas.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useWorkflow } from '../WorkflowContext'
import { NodeShell } from '../components/NodeShell'
import { NodeHeader } from '../components/NodeHeader'
import { NodeFrame } from '../components/NodeFrame'
import { standardNodeActions, downloadAction } from '../components/nodeActions'
import { useUpstreamText } from '../hooks/useUpstreamData'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { ActionIcons, DEFAULT_ICON_PROPS } from '../theme/icons'
import { wfColors, wfRadius } from '../theme/workflowTheme'
import type { NodeAction } from '../components/NodeActionsToolbar'
import type { Asset } from '@/lib/assets'
import { CharacterPicker } from '@/components/avatar/CharacterPicker'
import { useAvatarGeneration, type AvatarRefImage } from '@/components/avatar/useAvatarGeneration'

const ASPECT_OPTIONS = ['9:16', '16:9', '1:1']
const DURATION_OPTIONS = [5, 8, 10]

/** Largura do card por aspect — mesmo padrão do VideoNode (pra evitar
 *  apertar 16:9 e esticar 9:16). */
const WIDTH_BY_ASPECT: Record<string, number> = {
  '16:9': 380,
  '1:1': 300,
  '9:16': 280,
}
const getNodeWidth = (aspectRatio: string): number =>
  WIDTH_BY_ASPECT[aspectRatio] ?? 300

export function AvatarNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { updateNode, duplicateNode, deleteNode } = useWorkflow()
  const accent = (data.color as string) || getNodeTypeMeta('avatar').color

  const characterId = (data.characterId as string) ?? null
  const script = (data.script as string) ?? ''
  const aspectRatio = (data.aspectRatio as string) ?? '9:16'
  const duration = (data.duration as number) ?? 5
  const persistedVideoUrl = (data.videoUrl as string) ?? null

  const [localScript, setLocalScript] = useState(script)
  const [character, setCharacter] = useState<Asset | null>(null)
  const [charLoading, setCharLoading] = useState(false)

  // Resolve o characterId persistido → Asset completo ao montar / quando muda
  useEffect(() => {
    if (!characterId) { setCharacter(null); return }
    if (character?.id === characterId) return
    setCharLoading(true)
    fetch('/api/assets?type=character')
      .then(r => r.json())
      .then((payload: { assets?: Asset[] }) => {
        const found = (payload.assets ?? []).find(a => a.id === characterId) ?? null
        setCharacter(found)
        setCharLoading(false)
      })
      .catch(() => setCharLoading(false))
  }, [characterId, character?.id])

  const upstreamText = useUpstreamText(id)
  const effectiveScript = (localScript.trim() || upstreamText?.trim() || '')

  const { generate, status, statusMsg, videoUrl, error, reset } = useAvatarGeneration()
  const isGenerating = status === 'generating' || status === 'polling'

  const activeVideoUrl = videoUrl ?? persistedVideoUrl
  const canRun = !!character && effectiveScript.length > 0 && !isGenerating

  const patchContent = useCallback((patch: Record<string, unknown>) => {
    updateNode(id, { content: patch })
  }, [id, updateNode])

  const commitScript = useCallback(() => {
    if (localScript !== script) patchContent({ script: localScript })
  }, [localScript, script, patchContent])

  const onPickCharacter = useCallback((c: Asset | null) => {
    setCharacter(c)
    patchContent({ characterId: c?.id ?? null })
  }, [patchContent])

  const handleRun = useCallback(async () => {
    if (!character || !canRun) return
    const refImages: AvatarRefImage[] = (character.imageUrls ?? [])
      .slice(0, 3)
      .map(url => ({ url, name: character.name, charId: character.id }))

    // Prefixa descrição canônica (bloco "Descrição Estática" do AAZ) —
    // essa é a parte que trava identidade no Seedance.
    const scopedPrompt = character.description
      ? `${character.description}. ${effectiveScript}`
      : effectiveScript

    try {
      const url = await generate({
        prompt: scopedPrompt,
        refImages,
        aspectRatio,
        duration,
        generateAudio: true,
      })
      patchContent({ videoUrl: url })
    } catch {
      /* erro já refletido no hook */
    }
  }, [character, canRun, effectiveScript, aspectRatio, duration, generate, patchContent])

  const actions: NodeAction[] = useMemo(() => [
    ...(downloadAction(activeVideoUrl, 'avatar.mp4') ? [downloadAction(activeVideoUrl, 'avatar.mp4')!] : []),
    ...standardNodeActions(id, { duplicateNode, deleteNode }),
  ], [id, activeVideoUrl, duplicateNode, deleteNode])

  const cellAspect = aspectRatio.replace(':', ' / ')

  return (
    <NodeFrame
      inputs={[{ dataType: 'text', id: 'script', label: 'Script' }]}
      outputs={[{ dataType: 'video' }]}
      actions={actions}
    >
      <NodeShell
        type="avatar"
        selected={selected}
        colorOverride={accent}
        width={getNodeWidth(aspectRatio)}
        flush
        glow={isGenerating ? 'pulse' : undefined}
      >
        <div style={{ padding: '10px 12px 2px' }}>
          <NodeHeader
            type="avatar"
            accent={accent}
            right={isGenerating ? (
              <span style={{ fontSize: 10, color: accent }}>
                {statusMsg || 'gerando…'}
              </span>
            ) : character ? (
              <span style={{ fontSize: 10, color: wfColors.textDim }}>
                {duration}s · {character.name}
              </span>
            ) : undefined}
          />
        </div>

        {/* Preview — vídeo gerado OU primeira foto do character */}
        <div style={{ padding: '0 12px', marginBottom: 8 }}>
          {activeVideoUrl ? (
            <div style={{
              aspectRatio: cellAspect, borderRadius: wfRadius.control,
              overflow: 'hidden', background: wfColors.surfaceDeep,
              border: `1px solid ${accent}55`,
            }}>
              <video
                src={activeVideoUrl}
                controls
                playsInline
                className="nodrag nowheel"
                style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
              />
            </div>
          ) : character?.imageUrls?.[0] ? (
            <div style={{
              aspectRatio: cellAspect, borderRadius: wfRadius.control,
              overflow: 'hidden', position: 'relative',
              background: wfColors.surfaceDeep,
              border: `1px solid ${accent}55`,
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={character.imageUrls[0]}
                alt={character.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute', top: 6, left: 6,
                padding: '2px 8px', borderRadius: 4,
                background: accent, color: '#0A0814',
                fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
              }}>
                {character.name}
              </div>
            </div>
          ) : (
            <div style={{
              aspectRatio: cellAspect, background: wfColors.surfaceDeep,
              border: `1px dashed ${wfColors.border}`, borderRadius: wfRadius.control,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: wfColors.textFaint, fontSize: 11,
            }}>
              {charLoading ? 'Carregando…' : 'Selecione um personagem'}
            </div>
          )}
        </div>

        {/* Character picker */}
        <div className="nodrag nowheel" style={{ padding: '0 12px 8px' }}>
          <CharacterPicker
            value={character?.id ?? null}
            onChange={onPickCharacter}
            accent={accent}
            compact
          />
        </div>

        {/* Script textarea */}
        <div className="nodrag" style={{ padding: '0 12px 8px' }}>
          <textarea
            value={localScript}
            onChange={e => setLocalScript(e.target.value)}
            onBlur={commitScript}
            placeholder={upstreamText
              ? `Conectado (upstream): "${upstreamText.slice(0, 60)}…"`
              : character
                ? `O que ${character.name} deve falar/fazer...`
                : 'Selecione um personagem primeiro...'}
            disabled={isGenerating}
            style={{
              width: '100%', minHeight: 64, padding: 8,
              background: wfColors.surfaceDeep,
              border: `1px solid ${wfColors.border}`,
              borderRadius: wfRadius.control,
              color: wfColors.text, fontSize: 12, fontFamily: 'inherit',
              resize: 'vertical', outline: 'none', lineHeight: 1.4,
            }}
          />
        </div>

        {error && (
          <div style={{
            margin: '0 12px 8px', padding: '5px 8px', borderRadius: wfRadius.control,
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
          {ASPECT_OPTIONS.map(ar => (
            <button
              key={ar}
              onClick={() => patchContent({ aspectRatio: ar })}
              disabled={isGenerating}
              style={{
                height: 22, padding: '0 8px',
                background: aspectRatio === ar ? `${accent}25` : 'transparent',
                border: `1px solid ${aspectRatio === ar ? accent : wfColors.border}`,
                borderRadius: wfRadius.control,
                color: aspectRatio === ar ? accent : wfColors.textDim,
                fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
                cursor: isGenerating ? 'default' : 'pointer',
              }}
            >
              {ar}
            </button>
          ))}
          {DURATION_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => patchContent({ duration: d })}
              disabled={isGenerating}
              style={{
                height: 22, padding: '0 8px',
                background: duration === d ? `${accent}25` : 'transparent',
                border: `1px solid ${duration === d ? accent : wfColors.border}`,
                borderRadius: wfRadius.control,
                color: duration === d ? accent : wfColors.textDim,
                fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
                cursor: isGenerating ? 'default' : 'pointer',
              }}
            >
              {d}s
            </button>
          ))}

          {activeVideoUrl && !isGenerating && (
            <button
              onClick={() => { reset(); patchContent({ videoUrl: null }) }}
              title="Limpar e gerar novo"
              style={{
                marginLeft: 'auto',
                height: 22, padding: '0 8px',
                background: 'transparent',
                border: `1px solid ${wfColors.border}`,
                borderRadius: wfRadius.control,
                color: wfColors.textDim, fontSize: 10, fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              Novo
            </button>
          )}

          <button
            onClick={() => void handleRun()}
            disabled={!canRun}
            style={{
              marginLeft: activeVideoUrl ? 0 : 'auto',
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
            {isGenerating ? 'Gerando…' : 'Gerar'}
          </button>
        </div>
      </NodeShell>
    </NodeFrame>
  )
}
