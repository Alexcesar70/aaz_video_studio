'use client'

import React, { useCallback, useState } from 'react'
import { UIIcons, DEFAULT_ICON_PROPS } from '../../theme/icons'
import { wfColors, wfRadius } from '../../theme/workflowTheme'

/**
 * Editor de prompt embutido em nós geradores (Video/Image/Audio).
 * Combina:
 *   - textarea local editável (value controlado pelo pai)
 *   - Refinar inline: chama SmartPrompter e SUBSTITUI o texto com o
 *     refinado (praticidade — não cria outro nó)
 *   - Preview opcional do valor upstream quando há cabo conectado
 *     (se local estiver vazio, o efetivo será o upstream)
 *
 * O componente pai decide quando persistir no `content` do nó — expõe
 * onChange (digitação) e onCommit (blur) separadamente.
 *
 * Arquitetura limpa:
 *   - Componente puramente visual + hook interno de refine
 *   - Sem dependência direta do WorkflowContext
 *   - Pode ser reusado em qualquer nó gerador sem mudanças
 */

export interface PromptEditorProps {
  /** Valor local (persistido em data.prompt) */
  value: string
  /** Callback de digitação */
  onChange: (next: string) => void
  /** Callback quando o textarea perde foco — pai decide persistir */
  onCommit: () => void
  /** Callback quando o botão Refinar completa — substitui + persiste */
  onRefined?: (refinedPrompt: string) => void
  /** Valor vindo do nó upstream conectado (readonly display) */
  upstream?: string | null
  /** Cor de acento (borda/focus/botão) */
  accent: string
  /** Desabilita edição + refinar */
  disabled?: boolean
  placeholder?: string
  /** Altura mínima do textarea (px). Default 100 */
  minHeight?: number
}

export function PromptEditor({
  value,
  onChange,
  onCommit,
  onRefined,
  upstream,
  accent,
  disabled = false,
  placeholder = 'Descreva o que quer gerar…',
  minHeight = 100,
}: PromptEditorProps) {
  const [refining, setRefining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = value || upstream || ''
  const hasContent = current.trim().length > 0
  const canRefine = hasContent && !refining && !disabled

  const refine = useCallback(async () => {
    if (!canRefine) return
    setRefining(true)
    setError(null)
    try {
      const res = await fetch('/api/smart-prompter/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: current.trim() }),
      })
      const data = await res.json() as { refinedPrompt?: string; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Falha ao refinar.')
        return
      }
      if (data.refinedPrompt && onRefined) {
        onRefined(data.refinedPrompt)
      }
    } catch {
      setError('Erro de conexão.')
    } finally {
      setRefining(false)
    }
  }, [canRefine, current, onRefined])

  return (
    <div className="nodrag" style={{ position: 'relative' }}>
      {/* Badge indicando upstream quando relevante */}
      {upstream && !value && (
        <div style={{
          position: 'absolute', top: 6, right: 8,
          padding: '1px 6px', borderRadius: 3,
          background: `${accent}22`, border: `1px solid ${accent}55`,
          fontSize: 8, fontWeight: 700, letterSpacing: 0.3,
          color: accent, textTransform: 'uppercase',
          pointerEvents: 'none', zIndex: 1,
        }}>
          conectado
        </div>
      )}

      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onCommit}
        placeholder={upstream ? `${upstream.slice(0, 80)}${upstream.length > 80 ? '…' : ''}` : placeholder}
        disabled={disabled}
        style={{
          width: '100%', minHeight, padding: 10, borderRadius: wfRadius.inner,
          background: wfColors.surfaceDeep,
          border: `1px solid ${refining ? accent : wfColors.border}`,
          color: wfColors.text,
          fontSize: 13, fontFamily: 'inherit',
          resize: 'vertical', outline: 'none',
          lineHeight: 1.5,
          transition: 'border-color 160ms ease',
          opacity: disabled ? 0.5 : 1,
          marginBottom: 6,
        }}
      />

      {error && (
        <div style={{
          padding: '5px 8px', marginBottom: 6, borderRadius: wfRadius.control,
          background: '#ff5d7a15', border: '1px solid #ff5d7a30',
          fontSize: 10, color: '#ff5d7a',
        }}>
          {error}
        </div>
      )}

      <button
        onClick={refine}
        disabled={!canRefine}
        title={canRefine ? 'Refinar com IA (Smart Prompter)' : 'Escreva ou conecte um texto pra refinar'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          height: 22, padding: '0 10px',
          background: refining ? `${accent}30` : 'transparent',
          border: `1px solid ${canRefine ? `${accent}66` : wfColors.border}`,
          borderRadius: wfRadius.control,
          color: canRefine ? accent : wfColors.textFaint,
          fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
          cursor: canRefine ? 'pointer' : 'default',
        }}
      >
        <UIIcons.refine size={11} {...DEFAULT_ICON_PROPS} />
        {refining ? 'Refinando…' : 'Refinar com IA'}
      </button>
    </div>
  )
}
