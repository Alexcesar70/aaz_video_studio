'use client'

import React, { useState, useRef, useEffect } from 'react'
import { C } from './theme'
import type { SpielbergMode, SpielbergMessage, CapturedVariable } from '@/modules/spielberg'

interface SpielbergChatProps {
  mode: SpielbergMode
  context?: Record<string, unknown>
  onVariablesCaptured?: (variables: CapturedVariable[]) => void
  onReply?: (reply: string) => void
  compact?: boolean
  placeholder?: string
}

export function SpielbergChat({
  mode,
  context = {},
  onVariablesCaptured,
  onReply,
  compact = false,
  placeholder = 'falar com Spielberg...',
}: SpielbergChatProps) {
  const [messages, setMessages] = useState<SpielbergMessage[]>([])
  const [variables, setVariables] = useState<CapturedVariable[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setLoading(true)

    const newMessages: SpielbergMessage[] = [
      ...messages,
      { role: 'user', content: userMsg, timestamp: new Date().toISOString() },
    ]
    setMessages(newMessages)

    try {
      const res = await fetch('/api/spielberg/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          message: userMsg,
          history: messages,
          variables,
          context,
        }),
      })

      const data = await res.json()
      if (data.reply) {
        const assistantMsg: SpielbergMessage = {
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toISOString(),
        }
        setMessages(prev => [...prev, assistantMsg])
        onReply?.(data.reply)
      }
      if (data.extractedVariables?.length) {
        const updated = [...variables]
        const existing = new Map(updated.map(v => [v.key, v]))
        for (const v of data.extractedVariables) existing.set(v.key, v)
        const merged = Array.from(existing.values())
        setVariables(merged)
        onVariablesCaptured?.(merged)
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Desculpe, tive um problema. Tente de novo.',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
    }
  }

  const height = compact ? 300 : 500

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
      display: 'flex', flexDirection: 'column', height,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 18 }}>🎬</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Spielberg</div>
          <div style={{ fontSize: 10, color: C.textDim }}>
            {mode === 'briefing' && 'capturando intenção narrativa'}
            {mode === 'scene' && 'definindo variáveis da cena'}
            {mode === 'review' && 'analisando resultado'}
            {mode === 'creators' && 'consultor de conteúdo'}
          </div>
        </div>
        {variables.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: C.purple, fontFamily: 'monospace' }}>
            {variables.length} vars
          </span>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 16px', color: C.textDim, fontSize: 12 }}>
            {mode === 'briefing' && 'Me conta a história que você quer contar...'}
            {mode === 'scene' && 'Vamos definir a direção dessa cena.'}
            {mode === 'review' && 'Vou analisar o que foi criado.'}
            {mode === 'creators' && 'Sobre o que quer criar conteúdo?'}
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            marginBottom: 12,
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '80%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              background: msg.role === 'user' ? `${C.purple}20` : C.surface,
              border: `1px solid ${msg.role === 'user' ? `${C.purple}40` : C.border}`,
              fontSize: 13, lineHeight: 1.5, color: C.text,
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 4, padding: '8px 0' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%', background: C.purple,
                animation: `pulse 1s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
            <style>{`@keyframes pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }`}</style>
          </div>
        )}
      </div>

      {/* Variables strip */}
      {variables.length > 0 && (
        <div style={{
          padding: '6px 12px', borderTop: `1px solid ${C.border}`,
          display: 'flex', flexWrap: 'wrap', gap: 4,
        }}>
          {variables.map(v => (
            <span key={v.key} style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 6,
              background: v.category === 'hard' ? `${C.green}15` : `${C.purple}15`,
              color: v.category === 'hard' ? C.green : C.purple,
              border: `1px solid ${v.category === 'hard' ? `${C.green}30` : `${C.purple}30`}`,
            }}>
              {v.key}: {v.value}
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '10px 12px', borderTop: `1px solid ${C.border}`,
        display: 'flex', gap: 8,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder={placeholder}
          disabled={loading}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 8,
            background: C.surface, border: `1px solid ${C.border}`,
            color: C.text, fontSize: 13, fontFamily: 'inherit', outline: 'none',
          }}
        />
        <button onClick={send} disabled={!input.trim() || loading}
          style={{
            padding: '8px 14px', borderRadius: 8,
            background: input.trim() ? C.purple : C.card,
            border: 'none', color: input.trim() ? '#fff' : C.textDim,
            cursor: input.trim() ? 'pointer' : 'default',
            fontSize: 14, fontFamily: 'inherit',
          }}>↑</button>
      </div>
    </div>
  )
}

export { SpielbergChat as default }
