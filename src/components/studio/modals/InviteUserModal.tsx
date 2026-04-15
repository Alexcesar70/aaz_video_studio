'use client'

/**
 * InviteUserModal — modal de admin para criar novo usuário.
 *
 * Cria via POST /api/users + dispara `onCreated` com as credenciais
 * geradas (mostradas UMA vez via NewUserCredsModal).
 *
 * Extraído de AAZStudio.tsx (M6-PR6).
 */

import React, { useState } from 'react'
import { C } from '../theme'
import { Input } from '../atoms'
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  PRODUCTS,
  PRODUCT_LABELS,
  type Permission,
  type Product,
} from '@/lib/permissions'

interface Props {
  onClose: () => void
  onCreated: (creds: {
    email: string
    name: string
    password: string
  }) => void
}

export function InviteUserModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'creator'>('creator')
  const [budget, setBudget] = useState('')
  const [selPermissions, setSelPermissions] = useState<string[]>([])
  const [selProducts, setSelProducts] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const togglePermission = (p: string) =>
    setSelPermissions((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    )
  const toggleProduct = (p: string) =>
    setSelProducts((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    )

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      setError('Nome e email são obrigatórios.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          role,
          monthlyBudgetUsd: budget ? parseFloat(budget) : undefined,
          permissions: selPermissions.length > 0 ? selPermissions : undefined,
          products: selProducts.length > 0 ? selProducts : undefined,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e?.error || `Erro ${res.status}`)
      }
      const data = await res.json()
      onCreated({
        email: data.user.email,
        name: data.user.name,
        password: data.plainPassword,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar.')
    } finally {
      setLoading(false)
    }
  }

  const allPerms = Object.values(PERMISSIONS) as Permission[]
  const allProducts = Object.values(PRODUCTS) as Product[]

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          width: '100%',
          maxWidth: 500,
          padding: 24,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          Convidar criador
        </div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 20 }}>
          Uma senha será gerada automaticamente. Envie por WhatsApp/Slack.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={labelStyle()}>NOME COMPLETO</div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Maria Silva"
            />
          </div>
          <div>
            <div style={labelStyle()}>EMAIL</div>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maria@example.com"
            />
          </div>
          <div>
            <div style={labelStyle()}>ROLE</div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'creator')}
              style={{
                width: '100%',
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: '10px 14px',
                color: C.text,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            >
              <option value="creator">Creator -- cria cenas/assets</option>
              <option value="admin">Admin -- ve tudo, gerencia tudo</option>
            </select>
          </div>
          <div>
            <div style={labelStyle()}>BUDGET MENSAL (OPCIONAL, USD)</div>
            <Input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="50"
              step="10"
            />
          </div>

          {role === 'creator' && (
            <div>
              <div style={{ ...labelStyle(), marginBottom: 8 }}>
                PERMISSOES (OPCIONAL — SEM SELECAO = TODAS DO ROLE)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {allPerms.map((p) => (
                  <label
                    key={p}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      padding: '4px 0',
                      fontSize: 13,
                      color: C.text,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selPermissions.includes(p)}
                      onChange={() => togglePermission(p)}
                      style={{ accentColor: C.purple, width: 16, height: 16 }}
                    />
                    {PERMISSION_LABELS[p]}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <div style={{ ...labelStyle(), marginBottom: 8 }}>
              PRODUTOS (OPCIONAL — SEM SELECAO = TODOS)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {allProducts.map((p) => (
                <label
                  key={p}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    padding: '4px 0',
                    fontSize: 13,
                    color: C.text,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selProducts.includes(p)}
                    onChange={() => toggleProduct(p)}
                    style={{ accentColor: C.blue, width: 16, height: 16 }}
                  />
                  {PRODUCT_LABELS[p]}
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div
              style={{
                background: `${C.red}15`,
                border: `1px solid ${C.red}40`,
                borderRadius: 8,
                padding: '9px 12px',
                fontSize: 12,
                color: C.red,
              }}
            >
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                background: 'transparent',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '12px',
                cursor: 'pointer',
                color: C.textDim,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={loading}
              style={{
                flex: 1,
                background: loading ? C.card : C.gold,
                border: `1px solid ${C.gold}`,
                borderRadius: 10,
                padding: '12px',
                cursor: loading ? 'wait' : 'pointer',
                color: loading ? C.textDim : '#000',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: 'inherit',
              }}
            >
              {loading ? '⟳ Criando...' : 'Gerar senha e criar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function labelStyle(): React.CSSProperties {
  return {
    fontSize: 10,
    fontWeight: 700,
    color: C.textDim,
    marginBottom: 5,
    letterSpacing: '0.5px',
  }
}
