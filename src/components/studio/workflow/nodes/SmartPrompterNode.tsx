'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { useWorkflow } from '../WorkflowContext'
import { NodeShell } from '../components/NodeShell'
import { NodeHeader } from '../components/NodeHeader'
import { NodeFrame } from '../components/NodeFrame'
import { standardNodeActions } from '../components/nodeActions'
import { useUpstreamText } from '../hooks/useUpstreamData'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { ActionIcons, UIIcons, DEFAULT_ICON_PROPS } from '../theme/icons'
import { wfColors, wfRadius } from '../theme/workflowTheme'
import type { NodeAction } from '../components/NodeActionsToolbar'
import type { PromptAnalysis, PromptSuggestion } from '@/modules/smart-prompter'

const CATEGORY_META: Record<PromptSuggestion['category'], { icon: string; color: string; label: string }> = {
  composition: { icon: '🖼', color: '#7F77DD', label: 'Composição' },
  lighting: { icon: '💡', color: '#E5B87A', label: 'Iluminação' },
  movement: { icon: '🎥', color: '#5DCAA5', label: 'Movimento' },
  emotion: { icon: '💭', color: '#D4A0C8', label: 'Emoção' },
  style: { icon: '🎨', color: '#AFA9EC', label: 'Estilo' },
  technical: { icon: '⚙', color: '#9F9AB8', label: 'Técnico' },
}

export function SmartPrompterNode({
  id,
  data,
  selected,
}: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { updateNode, duplicateNode, deleteNode } = useWorkflow()
  const accent = (data.color as string) || getNodeTypeMeta('smart-prompter').color
  const upstreamText = useUpstreamText(id)

  const persisted = {
    refinedPrompt: (data.refinedPrompt as string) ?? '',
    score: (data.score as number) ?? 0,
    summary: (data.summary as string) ?? '',
    suggestions: (data.suggestions as PromptSuggestion[]) ?? [],
  }

  const [localRefined, setLocalRefined] = useState(persisted.refinedPrompt)
  const [refining, setRefining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [editing, setEditing] = useState(false)

  const sourcePrompt = upstreamText?.trim() ?? ''
  const canRefine = sourcePrompt.length > 0 && !refining

  const hasOutput = persisted.refinedPrompt.length > 0 || localRefined.length > 0
  const currentText = editing ? localRefined : persisted.refinedPrompt

  const runRefine = useCallback(async () => {
    if (!canRefine) return
    setRefining(true)
    setError(null)
    try {
      const res = await fetch('/api/smart-prompter/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: sourcePrompt }),
      })
      const analysis = await res.json() as PromptAnalysis & { error?: string }
      if (!res.ok) {
        setError(analysis.error ?? 'Falha ao refinar.')
        return
      }
      setLocalRefined(analysis.refinedPrompt)
      updateNode(id, {
        content: {
          refinedPrompt: analysis.refinedPrompt,
          score: analysis.score,
          summary: analysis.summary,
          suggestions: analysis.suggestions,
        },
      })
    } catch {
      setError('Erro de conexão.')
    } finally {
      setRefining(false)
    }
  }, [canRefine, sourcePrompt, id, updateNode])

  const commitEdit = () => {
    setEditing(false)
    if (localRefined !== persisted.refinedPrompt) {
      updateNode(id, { content: { refinedPrompt: localRefined } })
    }
  }

  const actions: NodeAction[] = useMemo(() => [
    {
      id: 'refine',
      icon: <UIIcons.refine size={11} {...DEFAULT_ICON_PROPS} />,
      title: sourcePrompt ? 'Refinar prompt' : 'Conecte um texto pra refinar',
      tone: 'primary',
      disabled: !canRefine,
      onClick: () => { void runRefine() },
    },
    ...standardNodeActions(id, { duplicateNode, deleteNode }),
  ], [id, canRefine, sourcePrompt, runRefine, duplicateNode, deleteNode])

  return (
    <NodeFrame
      inputs={[{ dataType: 'text' }]}
      outputs={[{ dataType: 'prompt' }]}
      actions={actions}
    >
      <NodeShell
        type="smart-prompter"
        selected={selected}
        colorOverride={accent}
        width={290}
        glow={refining ? 'pulse' : undefined}
      >
        <NodeHeader
          type="smart-prompter"
          accent={accent}
          right={
            refining ? (
              <span style={{ fontSize: 10, color: accent }}>refinando…</span>
            ) : persisted.score > 0 ? (
              <span style={{ fontSize: 10, fontWeight: 700, color: persisted.score >= 80 ? '#5DCAA5' : persisted.score >= 60 ? '#E5B87A' : '#ff5d7a' }}>
                {persisted.score}/100
              </span>
            ) : undefined
          }
        />

        {/* Estado "sem conexão" */}
        {!sourcePrompt && !hasOutput && (
          <div style={{
            padding: 14, borderRadius: wfRadius.inner,
            background: wfColors.surfaceDeep, border: `1px dashed ${wfColors.border}`,
            fontSize: 11, color: wfColors.textDim, lineHeight: 1.5, textAlign: 'center',
          }}>
            Conecte um texto na entrada (esquerda) para refinar
          </div>
        )}

        {/* Preview do prompt de entrada (discreto) */}
        {sourcePrompt && !hasOutput && (
          <div style={{
            padding: 10, borderRadius: wfRadius.inner,
            background: wfColors.surfaceDeep, border: `1px solid ${wfColors.border}`,
            fontSize: 11, color: wfColors.textDim, lineHeight: 1.5,
            maxHeight: 70, overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color: wfColors.textFaint, marginBottom: 4 }}>
              Entrada
            </div>
            {sourcePrompt.length > 140 ? sourcePrompt.slice(0, 140) + '…' : sourcePrompt}
          </div>
        )}

        {/* Prompt refinado — editável */}
        {hasOutput && (
          <>
            {editing ? (
              <textarea
                value={localRefined}
                onChange={e => setLocalRefined(e.target.value)}
                onBlur={commitEdit}
                autoFocus
                className="nodrag"
                style={{
                  width: '100%', minHeight: 96, padding: 8, borderRadius: wfRadius.inner,
                  background: wfColors.surfaceDeep, border: `1px solid ${accent}55`,
                  color: wfColors.text, fontSize: 12, fontFamily: 'inherit',
                  resize: 'vertical', outline: 'none', marginBottom: 6,
                }}
              />
            ) : (
              <div
                onDoubleClick={() => { setLocalRefined(persisted.refinedPrompt); setEditing(true) }}
                style={{
                  padding: 10, borderRadius: wfRadius.inner,
                  background: wfColors.surfaceDeep, border: `1px solid ${accent}35`,
                  fontSize: 12, color: wfColors.text, lineHeight: 1.5,
                  cursor: 'text', marginBottom: 6,
                  maxHeight: 140, overflowY: 'auto', whiteSpace: 'pre-wrap',
                }}
              >
                {currentText || <span style={{ color: wfColors.textFaint }}>(vazio)</span>}
              </div>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: '6px 8px', marginBottom: 6, borderRadius: wfRadius.control,
            background: '#ff5d7a15', border: '1px solid #ff5d7a30',
            fontSize: 10, color: '#ff5d7a',
          }}>
            {error}
          </div>
        )}

        {/* Controles principais */}
        <div className="nodrag" style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => { void runRefine() }}
            disabled={!canRefine}
            style={{
              flex: 1, padding: '7px 10px', borderRadius: wfRadius.control,
              background: canRefine ? accent : wfColors.border,
              border: 'none',
              color: canRefine ? '#0A0814' : wfColors.textFaint,
              fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
              cursor: canRefine ? 'pointer' : 'default',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <UIIcons.refine size={12} {...DEFAULT_ICON_PROPS} />
            {refining ? 'Refinando…' : hasOutput ? 'Regenerar' : 'Refinar'}
          </button>

          {hasOutput && persisted.suggestions.length > 0 && (
            <button
              onClick={() => setShowDetails(s => !s)}
              title="Ver sugestões do refinamento"
              style={{
                width: 32, padding: 0, borderRadius: wfRadius.control,
                background: showDetails ? `${accent}25` : 'transparent',
                border: `1px solid ${wfColors.border}`,
                color: wfColors.textDim, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <EyeIcon open={showDetails} />
            </button>
          )}
        </div>

        {/* Detalhes das sugestões — popover dentro do próprio nó */}
        {showDetails && persisted.suggestions.length > 0 && (
          <div className="nodrag" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {persisted.summary && (
              <div style={{ fontSize: 11, color: wfColors.textDim, lineHeight: 1.4 }}>
                {persisted.summary}
              </div>
            )}
            {persisted.suggestions.map((s, i) => {
              const meta = CATEGORY_META[s.category] ?? CATEGORY_META.technical
              return (
                <div key={i} style={{
                  padding: '6px 8px', borderRadius: wfRadius.control,
                  background: wfColors.surfaceDeep, border: `1px solid ${wfColors.border}`,
                  fontSize: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                    <span>{meta.icon}</span>
                    <span style={{ fontWeight: 600, color: meta.color }}>{meta.label}</span>
                  </div>
                  <div style={{ color: wfColors.textDim, lineHeight: 1.4 }}>{s.reason}</div>
                </div>
              )
            })}
          </div>
        )}
      </NodeShell>
    </NodeFrame>
  )
}

/**
 * Ícone de olho simples pra abrir/fechar detalhes. Mantido inline aqui
 * pra não poluir o kit — é específico deste nó.
 */
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.94 10.94 0 0112 19c-6.5 0-10-7-10-7a19.3 19.3 0 013.06-4.1" />
          <path d="M9.88 5.05A10.94 10.94 0 0112 5c6.5 0 10 7 10 7a19.3 19.3 0 01-3.06 4.1" />
          <path d="M1 1l22 22" />
        </>
      )}
    </svg>
  )
}
