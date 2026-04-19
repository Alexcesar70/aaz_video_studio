'use client'
import React, { useCallback, useMemo, useState } from 'react'
import { useWorkflow } from '../WorkflowContext'
import { NodeShell } from '../components/NodeShell'
import { NodeHeader } from '../components/NodeHeader'
import { NodeFrame } from '../components/NodeFrame'
import { OutputsGrid } from '../components/OutputsGrid'
import { SelectControl, type SelectOption } from '../components/controls/SelectControl'
import { CountControl } from '../components/controls/CountControl'
import { UploadControl } from '../components/controls/UploadControl'
import { standardNodeActions, downloadAction } from '../components/nodeActions'
import { useUpstreamText, useUpstreamImage } from '../hooks/useUpstreamData'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { ActionIcons, NODE_TYPE_ICONS, DEFAULT_ICON_PROPS } from '../theme/icons'
import { wfColors, wfRadius } from '../theme/workflowTheme'
import type { NodeAction } from '../components/NodeActionsToolbar'
import { IMAGE_ENGINES, DEFAULT_IMAGE_ENGINE_ID } from '@/lib/imageEngines'

/**
 * Image Generator — equivalente ao container "Image Generator" do
 * Freepik Spaces. Funciona como nó gerador ativo:
 *
 * - Textarea interna (ou herda texto do upstream via edge)
 * - Seletor de modelo (Segmind engines)
 * - Seletor de aspect ratio
 * - Seletor de quantidade (1/2/4)
 * - Upload de imagem de referência (blob)
 * - Botão Run dispara /api/generate-image
 * - Outputs ficam DENTRO do card em grid adaptativo
 * - Click num output → "selecionado" alimenta o handle de saída
 * - Container adapta ao aspect ratio do output escolhido
 *
 * Mantém compatibilidade com boards antigos (campo legado `url` vira
 * primeiro output). Uncle Bob: controles extraídos em components/
 * separados, cada um single-responsibility.
 */

const ASPECT_OPTIONS: SelectOption[] = [
  { value: '1:1', label: '1:1', hint: 'Quadrado' },
  { value: '16:9', label: '16:9', hint: 'Wide' },
  { value: '9:16', label: '9:16', hint: 'Stories' },
  { value: '4:3', label: '4:3', hint: 'Clássico' },
  { value: '3:4', label: '3:4', hint: 'Retrato' },
]

const COUNT_OPTIONS = [1, 2, 4] as const

interface StoredOutput { url: string }

type ImageCount = typeof COUNT_OPTIONS[number]

function parseCount(raw: unknown): ImageCount {
  return raw === 2 || raw === 4 ? raw : 1
}

export function ImageNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { updateNode, duplicateNode, deleteNode } = useWorkflow()
  const accent = (data.color as string) || getNodeTypeMeta('image').color

  // Estado persistido (sem prompt local — prompt vem sempre de upstream)
  const modelId = (data.modelId as string) ?? DEFAULT_IMAGE_ENGINE_ID
  const aspectRatio = (data.aspectRatio as string) ?? '1:1'
  const count = parseCount(data.count)
  const referenceImageUrl = (data.referenceImageUrl as string) ?? undefined

  // Outputs: retrocompat com boards antigos que só guardavam `url`
  const legacyUrl = data.url as string | undefined
  const persistedOutputs = (data.outputs as StoredOutput[] | undefined)
    ?? (legacyUrl ? [{ url: legacyUrl }] : [])
  const selectedIndex = typeof data.selectedIndex === 'number' ? data.selectedIndex : 0

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Prompt vem SEMPRE de upstream (TextNode ou SmartPrompter conectado)
  const upstreamText = useUpstreamText(id)
  const upstreamImage = useUpstreamImage(id)

  const effectivePrompt = (upstreamText ?? '').trim()
  const effectiveReference = upstreamImage ?? referenceImageUrl
  const canRun = effectivePrompt.length > 0 && !generating

  const patchContent = useCallback((patch: Record<string, unknown>) => {
    updateNode(id, { content: patch })
  }, [id, updateNode])

  const handleRun = useCallback(async () => {
    if (!canRun) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: effectivePrompt,
          num_outputs: count,
          aspect_ratio: aspectRatio,
          engineId: modelId,
          reference_image_url: effectiveReference,
        }),
      })
      const payload = await res.json() as { imageUrls?: string[]; error?: string }
      if (!res.ok) {
        setError(payload.error ?? 'Falha ao gerar.')
        return
      }
      const urls = payload.imageUrls ?? []
      if (urls.length === 0) {
        setError('Sem imagem retornada.')
        return
      }
      const outputs: StoredOutput[] = urls.map(url => ({ url }))
      patchContent({ outputs, selectedIndex: 0, url: urls[0] })
    } catch {
      setError('Erro de conexão.')
    } finally {
      setGenerating(false)
    }
  }, [canRun, effectivePrompt, count, aspectRatio, modelId, effectiveReference, patchContent])

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
    {
      id: 'run',
      icon: <ActionIcons.run size={11} {...DEFAULT_ICON_PROPS} />,
      title: effectivePrompt ? 'Gerar imagem' : 'Escreva ou conecte um prompt',
      tone: 'primary',
      disabled: !canRun,
      onClick: () => { void handleRun() },
    },
    ...(downloadAction(selectedUrl, 'image.png') ? [downloadAction(selectedUrl, 'image.png')!] : []),
    ...standardNodeActions(id, { duplicateNode, deleteNode }),
  ], [id, effectivePrompt, canRun, selectedUrl, handleRun, duplicateNode, deleteNode])

  const modelOptions: SelectOption[] = useMemo(
    () => IMAGE_ENGINES.map(e => ({ value: e.id, label: e.name })),
    [],
  )

  const cellAspect = aspectRatio.replace(':', ' / ')
  const hasOutputs = persistedOutputs.length > 0

  return (
    <NodeFrame
      inputs={[{ dataType: 'text' }]}
      outputs={[{ dataType: 'image' }]}
      actions={actions}
    >
      <NodeShell
        type="image"
        selected={selected}
        colorOverride={accent}
        width={300}
        flush
        glow={generating ? 'pulse' : undefined}
      >
        <div style={{ padding: '10px 12px 2px' }}>
          <NodeHeader
            type="image"
            accent={accent}
            right={generating ? (
              <span style={{ fontSize: 10, color: accent }}>gerando…</span>
            ) : hasOutputs ? (
              <span style={{ fontSize: 10, color: wfColors.textDim }}>
                {persistedOutputs.length} output{persistedOutputs.length > 1 ? 's' : ''}
              </span>
            ) : undefined}
          />
        </div>

        {/* Preview area — placeholder ou grid de outputs */}
        <div style={{
          padding: '0 12px',
          marginBottom: 8,
        }}>
          {hasOutputs ? (
            <OutputsGrid
              outputs={persistedOutputs}
              selectedIndex={selectedIndex}
              onSelect={handleSelectOutput}
              onDelete={handleDeleteOutput}
              cellAspect={cellAspect}
              accent={accent}
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
                const I = NODE_TYPE_ICONS.image
                return <I size={28} color={wfColors.textFaint} strokeWidth={1.25} />
              })()}
            </div>
          )}
        </div>

        {/* Hint quando faltam conexões */}
        {!upstreamText && (
          <div style={{
            padding: '0 12px 8px',
            fontSize: 10, color: wfColors.textFaint, textAlign: 'center',
          }}>
            conecte um Texto ou Smart Prompter ←
          </div>
        )}

        {/* Error banner */}
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
            minWidth={120}
          />
          <SelectControl
            options={ASPECT_OPTIONS}
            value={aspectRatio}
            onChange={v => patchContent({ aspectRatio: v })}
            minWidth={62}
          />
          <CountControl
            options={COUNT_OPTIONS}
            value={count}
            onChange={n => patchContent({ count: n })}
            accent={accent}
            disabled={generating}
          />
          <UploadControl
            onUploaded={url => patchContent({ referenceImageUrl: url })}
            hasValue={!!referenceImageUrl}
            accent={accent}
            disabled={generating}
            title={referenceImageUrl ? 'Referência anexada' : 'Anexar referência'}
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
            <ActionIcons.run size={11} {...DEFAULT_ICON_PROPS} />
            {generating ? 'Gerando…' : 'Gerar'}
          </button>
        </div>
      </NodeShell>
    </NodeFrame>
  )
}
