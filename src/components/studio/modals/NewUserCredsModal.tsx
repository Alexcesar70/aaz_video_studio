'use client'

/**
 * NewUserCredsModal — exibe credenciais one-time após admin criar
 * um usuário. A senha só aparece nesta tela; depois, só via reset.
 *
 * Extraído de AAZStudio.tsx (M4-PR6).
 */

import React, { useState } from 'react'
import { C } from '../theme'

interface Props {
  creds: { email: string; name: string; password: string }
  onClose: () => void
}

export function NewUserCredsModal({ creds, onClose }: Props) {
  const [copied, setCopied] = useState(false)
  const fullText = `Email: ${creds.email}\nSenha: ${creds.password}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        zIndex: 101,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          background: C.bg,
          border: `2px solid ${C.green}60`,
          borderRadius: 14,
          width: '100%',
          maxWidth: 500,
          padding: 28,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, color: C.green, marginBottom: 4 }}>
          ✓ {creds.name} foi criado
        </div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 20 }}>
          Copie as credenciais e envie pro novo criador — a senha não vai aparecer de novo.
        </div>

        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 18,
            fontFamily: 'monospace',
            fontSize: 14,
            marginBottom: 14,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: C.textDim, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px' }}>
              EMAIL
            </span>
            <div style={{ color: C.text }}>{creds.email}</div>
          </div>
          <div>
            <span style={{ color: C.textDim, fontSize: 10, fontWeight: 700, letterSpacing: '0.5px' }}>
              SENHA
            </span>
            <div style={{ color: C.gold, fontSize: 16, letterSpacing: 1 }}>
              {creds.password}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={copy}
            style={{
              flex: 1,
              background: copied ? C.green : C.purple,
              border: `1px solid ${copied ? C.green : C.purple}`,
              borderRadius: 10,
              padding: '12px',
              cursor: 'pointer',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'inherit',
            }}
          >
            {copied ? '✓ Copiado!' : '📋 Copiar credenciais'}
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '12px 24px',
              cursor: 'pointer',
              color: C.textDim,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            Fechar
          </button>
        </div>

        <div
          style={{
            fontSize: 10,
            color: C.gold,
            marginTop: 14,
            fontStyle: 'italic',
            textAlign: 'center',
          }}
        >
          ⚠ Esta senha só aparece agora. Se fechar sem copiar, use &quot;Reset senha&quot; depois.
        </div>
      </div>
    </div>
  )
}
