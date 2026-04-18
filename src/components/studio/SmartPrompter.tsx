'use client'

import React, { useState } from 'react'
import { C } from './theme'
import type { PromptAnalysis, PromptSuggestion } from '@/modules/smart-prompter'

interface SmartPrompterProps {
  prompt: string
  engine?: string
  variables?: Record<string, string>
  styleProfile?: string
  onRefined?: (refinedPrompt: string) => void
  onAnalysis?: (analysis: PromptAnalysis) => void
}

const CATEGORY_META: Record<string, { icon: string; color: string; label: string }> = {
  composition: { icon: '🖼', color: '#7F77DD', label: 'Composição' },
  lighting: { icon: '💡', color: '#E5B87A', label: 'Iluminação' },
  movement: { icon: '🎥', color: '#5DCAA5', label: 'Movimento' },
  emotion: { icon: '💭', color: '#D4A0C8', label: 'Emoção' },
  style: { icon: '🎨', color: '#AFA9EC', label: 'Estilo' },
  technical: { icon: '⚙️', color: '#9F9AB8', label: 'Técnico' },
}

export function SmartPrompter({
  prompt,
  engine,
  variables,
  styleProfile,
  onRefined,
  onAnalysis,
}: SmartPrompterProps) {
  const [analysis, setAnalysis] = useState<PromptAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refine = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/smart-prompter/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, engine, variables, styleProfile }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao refinar.')
        return
      }
      setAnalysis(data)
      onAnalysis?.(data)
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  const applyRefined = () => {
    if (analysis?.refinedPrompt) {
      onRefined?.(analysis.refinedPrompt)
    }
  }

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Smart Prompter</div>
        </div>
        {analysis && (
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: analysis.score >= 80 ? C.green : analysis.score >= 60 ? C.gold : C.red,
          }}>
            {analysis.score}/100
          </div>
        )}
      </div>

      <div style={{ padding: '14px' }}>
        {!analysis ? (
          <>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12, lineHeight: 1.5 }}>
              Analisa e refina seu prompt antes de gerar — adiciona detalhes técnicos de câmera, iluminação e composição.
            </div>

            {error && (
              <div style={{ padding: '8px 12px', background: `${C.red}15`, border: `1px solid ${C.red}30`, borderRadius: 6, fontSize: 11, color: C.red, marginBottom: 10 }}>
                {error}
              </div>
            )}

            <button onClick={refine} disabled={!prompt.trim() || loading}
              style={{
                width: '100%', padding: '10px', borderRadius: 8,
                background: prompt.trim() ? `${C.purple}20` : C.surface,
                border: `1px solid ${prompt.trim() ? `${C.purple}40` : C.border}`,
                color: prompt.trim() ? C.purple : C.textDim,
                cursor: prompt.trim() ? 'pointer' : 'default',
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              {loading ? '⏳ Analisando...' : '⚡ Refinar prompt'}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, color: C.textDim, marginBottom: 8 }}>{analysis.summary}</div>

            {/* Suggestions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {analysis.suggestions.map((s: PromptSuggestion, i: number) => {
                const meta = CATEGORY_META[s.category] ?? CATEGORY_META.technical
                return (
                  <div key={i} style={{
                    padding: '8px 10px', borderRadius: 8,
                    background: C.surface, border: `1px solid ${C.border}`,
                    fontSize: 11,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span>{meta.icon}</span>
                      <span style={{ fontWeight: 600, color: meta.color }}>{meta.label}</span>
                    </div>
                    <div style={{ color: C.textDim, lineHeight: 1.5 }}>{s.reason}</div>
                  </div>
                )
              })}
            </div>

            {/* Refined prompt preview */}
            <div style={{
              padding: '10px 12px', borderRadius: 8,
              background: `${C.green}10`, border: `1px solid ${C.green}30`,
              fontSize: 11, color: C.text, lineHeight: 1.5,
              marginBottom: 12, maxHeight: 120, overflowY: 'auto',
            }}>
              {analysis.refinedPrompt}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={applyRefined}
                style={{
                  flex: 2, padding: '8px', borderRadius: 6,
                  background: C.green, border: 'none', color: '#fff',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                ✓ Usar prompt refinado
              </button>
              <button onClick={() => setAnalysis(null)}
                style={{
                  flex: 1, padding: '8px', borderRadius: 6,
                  background: C.surface, border: `1px solid ${C.border}`, color: C.textDim,
                  fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                Refazer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export { SmartPrompter as default }
