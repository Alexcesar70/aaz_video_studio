'use client'
import React, { useCallback, useMemo, useState } from 'react'
import { useWorkflow } from '../WorkflowContext'
import { NodeShell } from '../components/NodeShell'
import { NodeHeader } from '../components/NodeHeader'
import { NodeFrame } from '../components/NodeFrame'
import { SelectControl, type SelectOption } from '../components/controls/SelectControl'
import { standardNodeActions } from '../components/nodeActions'
import { useUpstreamText } from '../hooks/useUpstreamData'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { ActionIcons, DEFAULT_ICON_PROPS } from '../theme/icons'
import { wfColors, wfRadius } from '../theme/workflowTheme'
import type { NodeAction } from '../components/NodeActionsToolbar'

/**
 * Assistant Node — LLM livre (Claude) dentro do canvas. Útil pra tarefas
 * de texto genéricas que não são refinamento de prompt visual:
 * escrever poemas, extrair listas, resumir, traduzir, etc.
 *
 * Equivalente ao "Assistant Node" do Freepik Spaces. Diferença do
 * SmartPrompter: SP é especializado em REFINAR prompts de geração
 * visual (com categorias iluminação/técnico/etc); Assistant é livre.
 *
 * Inputs: text (contexto upstream opcional, concatenado ao prompt)
 * Outputs: text (resposta do modelo)
 *
 * Backend: POST /api/workflow/assistant → Claude API.
 */

const MODEL_OPTIONS: SelectOption[] = [
  { value: 'claude-opus', label: 'Claude Opus', hint: 'qualidade' },
  { value: 'claude-sonnet', label: 'Claude Sonnet', hint: 'equilíbrio' },
  { value: 'claude-haiku', label: 'Claude Haiku', hint: 'rápido' },
]

const FORMAT_OPTIONS: SelectOption[] = [
  { value: 'text', label: 'Texto' },
  { value: 'list', label: 'Lista' },
]

export function AssistantNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { updateNode, duplicateNode, deleteNode } = useWorkflow()
  const accent = (data.color as string) || getNodeTypeMeta('assistant').color

  const persistedPrompt = (data.prompt as string) ?? ''
  const modelId = (data.modelId as string) ?? 'claude-sonnet'
  const outputFormat = ((data.outputFormat as string) ?? 'text') as 'text' | 'list'
  const persistedResult = (data.text as string) ?? ''
  const persistedList = (data.list as string[] | undefined)

  const [localPrompt, setLocalPrompt] = useState(persistedPrompt)
  const [editingResult, setEditingResult] = useState(false)
  const [localResult, setLocalResult] = useState(persistedResult)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upstreamText = useUpstreamText(id)
  const hasUpstream = Boolean(upstreamText?.trim())

  // Prompt efetivo: upstream + (se user digitou algo na textarea) instrução
  const effectivePrompt = useMemo(() => {
    const parts: string[] = []
    if (upstreamText?.trim()) parts.push(upstreamText.trim())
    if (localPrompt.trim()) parts.push(localPrompt.trim())
    return parts.join('\n\n')
  }, [upstreamText, localPrompt])

  const canRun = effectivePrompt.length > 0 && !running

  const commitPrompt = useCallback(() => {
    if (localPrompt !== persistedPrompt) {
      updateNode(id, { content: { prompt: localPrompt } })
    }
  }, [id, localPrompt, persistedPrompt, updateNode])

  const commitResult = useCallback(() => {
    setEditingResult(false)
    if (localResult !== persistedResult) {
      updateNode(id, { content: { text: localResult } })
    }
  }, [id, localResult, persistedResult, updateNode])

  const patchContent = useCallback((patch: Record<string, unknown>) => {
    updateNode(id, { content: patch })
  }, [id, updateNode])

  const handleRun = useCallback(async () => {
    if (!canRun) return
    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/workflow/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: effectivePrompt,
          modelId,
          outputFormat,
        }),
      })
      const payload = await res.json() as {
        text?: string; list?: string[]; error?: string
      }
      if (!res.ok) {
        setError(payload.error ?? 'Falha na resposta.')
        return
      }
      const text = payload.text ?? ''
      setLocalResult(text)
      patchContent({ text, list: payload.list })
    } catch {
      setError('Erro de conexão.')
    } finally {
      setRunning(false)
    }
  }, [canRun, effectivePrompt, modelId, outputFormat, patchContent])

  const actions: NodeAction[] = useMemo(
    () => standardNodeActions(id, { duplicateNode, deleteNode }),
    [id, duplicateNode, deleteNode],
  )

  const hasResult = persistedResult.length > 0
  const displayList = outputFormat === 'list' && persistedList && persistedList.length > 0

  return (
    <NodeFrame
      inputs={[{ dataType: 'text' }]}
      outputs={[{ dataType: 'text' }]}
      actions={actions}
    >
      <NodeShell
        type="assistant"
        selected={selected}
        colorOverride={accent}
        width={300}
        glow={running ? 'pulse' : undefined}
      >
        <NodeHeader
          type="assistant"
          accent={accent}
          right={running ? (
            <span style={{ fontSize: 10, color: accent }}>pensando…</span>
          ) : hasResult ? (
            <span style={{ fontSize: 10, color: wfColors.textDim }}>
              {outputFormat === 'list' && persistedList ? `${persistedList.length} itens` : `${persistedResult.length} chars`}
            </span>
          ) : undefined}
        />

        {/* Upstream chip */}
        {hasUpstream && (
          <div style={{
            padding: '5px 8px', marginBottom: 6, borderRadius: wfRadius.control,
            background: `${accent}12`, border: `1px solid ${accent}35`,
            fontSize: 10, color: wfColors.textDim,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{ color: accent, fontWeight: 700 }}>●</span>
            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Contexto conectado — {upstreamText!.slice(0, 50)}{upstreamText!.length > 50 ? '…' : ''}
            </span>
          </div>
        )}

        {/* Prompt input */}
        <textarea
          value={localPrompt}
          onChange={e => setLocalPrompt(e.target.value)}
          onBlur={commitPrompt}
          placeholder={hasUpstream ? 'Instrução adicional (opcional)…' : 'O que você quer que eu faça?'}
          className="nodrag"
          style={{
            width: '100%', minHeight: 56, padding: 8, borderRadius: wfRadius.inner,
            background: wfColors.surfaceDeep, border: `1px solid ${wfColors.border}`,
            color: wfColors.text, fontSize: 12, fontFamily: 'inherit',
            resize: 'vertical', outline: 'none', marginBottom: 8,
            lineHeight: 1.4,
          }}
        />

        {/* Resultado */}
        {hasResult && (
          <div style={{ marginBottom: 8 }}>
            {editingResult ? (
              <textarea
                value={localResult}
                onChange={e => setLocalResult(e.target.value)}
                onBlur={commitResult}
                autoFocus
                className="nodrag"
                style={{
                  width: '100%', minHeight: 80, padding: 8, borderRadius: wfRadius.inner,
                  background: wfColors.surfaceDeep, border: `1px solid ${accent}55`,
                  color: wfColors.text, fontSize: 12, fontFamily: 'inherit',
                  resize: 'vertical', outline: 'none',
                }}
              />
            ) : (
              <div
                onDoubleClick={() => { setLocalResult(persistedResult); setEditingResult(true) }}
                style={{
                  padding: 10, borderRadius: wfRadius.inner,
                  background: wfColors.surfaceDeep, border: `1px solid ${accent}35`,
                  fontSize: 12, color: wfColors.text, lineHeight: 1.5,
                  cursor: 'text',
                  maxHeight: 180, overflowY: 'auto', whiteSpace: 'pre-wrap',
                }}
              >
                {displayList ? (
                  <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {persistedList!.map((item, i) => (
                      <li key={i} style={{ paddingLeft: 2 }}>{item}</li>
                    ))}
                  </ol>
                ) : (
                  persistedResult
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{
            padding: '6px 8px', marginBottom: 8, borderRadius: wfRadius.control,
            background: '#ff5d7a15', border: '1px solid #ff5d7a30',
            fontSize: 10, color: '#ff5d7a',
          }}>
            {error}
          </div>
        )}

        {/* Controles inferiores */}
        <div className="nodrag" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          borderTop: `1px solid ${wfColors.border}`,
          paddingTop: 8,
        }}>
          <SelectControl
            options={MODEL_OPTIONS}
            value={modelId}
            onChange={v => patchContent({ modelId: v })}
            minWidth={120}
          />
          <SelectControl
            options={FORMAT_OPTIONS}
            value={outputFormat}
            onChange={v => patchContent({ outputFormat: v, list: v === 'list' ? persistedList : undefined })}
            minWidth={70}
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
            {running ? 'Pensando…' : hasResult ? 'Refazer' : 'Executar'}
          </button>
        </div>
      </NodeShell>
    </NodeFrame>
  )
}
