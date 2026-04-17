'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

// Wizard mínimo: quando /api/auth/login responde needsWorkspaceSetup=true
// (flag NEW_SIGNUP_WIZARD ON + user sem org), mostramos este passo antes
// de seguir para /studio. UX completa (wizard multi-step com trial/team,
// billing, convites) vem em refactor de UI dedicado no M2.
type Step = 'login' | 'workspace_setup'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const [step, setStep] = useState<Step>('login')
  const [workspaceName, setWorkspaceName] = useState('')
  const [workspaceType, setWorkspaceType] = useState<'individual' | 'team'>('individual')
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const workspaceRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') || '/studio'

  useEffect(() => {
    if (step === 'login') emailRef.current?.focus()
    if (step === 'workspace_setup') workspaceRef.current?.focus()
  }, [step])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })

      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data.needsWorkspaceSetup) {
          // Pula para o passo de criação de workspace (flag NEW_SIGNUP_WIZARD ON)
          setWorkspaceName(data.user?.name ? `${data.user.name}'s Studio` : '')
          setStep('workspace_setup')
        } else {
          router.push(from)
          router.refresh()
        }
      } else {
        const data = await res.json()
        setError(data.error || 'Email ou senha incorretos.')
        setShake(true)
        setTimeout(() => setShake(false), 500)
        setPassword('')
        passwordRef.current?.focus()
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault()
    if (!workspaceName.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workspaceName.trim(),
          type: workspaceType,
        }),
      })

      if (res.ok) {
        router.push(from)
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Erro ao criar workspace.')
        setShake(true)
        setTimeout(() => setShake(false), 500)
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080A0F',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Palatino Linotype','Book Antiqua',Palatino,serif",
      padding: '24px',
    }}>
      {/* Background grid sutil */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(#1E253510 1px, transparent 1px), linear-gradient(90deg, #1E253510 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      {/* Glow de fundo */}
      <div style={{
        position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 600, height: 400, borderRadius: '50%',
        background: 'radial-gradient(ellipse, #C9A84C08 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: 380,
        background: '#0F1218',
        border: '1px solid #1E2535',
        borderRadius: 20,
        padding: '44px 40px',
        position: 'relative',
        animation: shake ? 'shake 0.4s ease' : undefined,
      }}>
        {/* Borda superior dourada */}
        <div style={{
          position: 'absolute', top: 0, left: '20%', right: '20%', height: 1,
          background: 'linear-gradient(90deg, transparent, #C9A84C60, transparent)',
        }} />

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, #C9A84C, #6A5828)',
            borderRadius: 14,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26,
            boxShadow: '0 0 32px #C9A84C28',
            marginBottom: 18,
          }}>✝</div>
          <div style={{
            fontSize: 20, fontWeight: 700,
            color: '#C9A84C',
            letterSpacing: 1,
            marginBottom: 6,
          }}>Creative Studio</div>
          <div style={{
            fontSize: 10, color: '#8A93A8',
            letterSpacing: 3, textTransform: 'uppercase',
          }}>Production Platform</div>
        </div>

        {step === 'workspace_setup' ? (
          <form onSubmit={handleCreateWorkspace} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              fontSize: 11, color: '#8A93A8',
              textAlign: 'center', marginBottom: 14,
              padding: '12px 14px', background: '#151A24', borderRadius: 10,
              border: '1px solid #1E2535',
            }}>
              Login confirmado. Como você quer chamar seu workspace?
            </div>

            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#C9A84C',
                letterSpacing: '2.5px', textTransform: 'uppercase',
                marginBottom: 8,
              }}>Nome do workspace</div>
              <input
                ref={workspaceRef}
                type="text"
                value={workspaceName}
                onChange={e => setWorkspaceName(e.target.value)}
                placeholder="Ex: Meu Studio"
                maxLength={80}
                style={{
                  width: '100%', background: '#151A24',
                  border: `1px solid ${error ? '#E74C3C60' : '#1E2535'}`,
                  borderRadius: 10, padding: '12px 14px', color: '#DCE1EE',
                  fontSize: 14, outline: 'none', fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#C9A84C',
                letterSpacing: '2.5px', textTransform: 'uppercase',
                marginBottom: 8,
              }}>Tipo</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['individual', 'team'] as const).map(t => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setWorkspaceType(t)}
                    style={{
                      flex: 1,
                      background: workspaceType === t ? '#C9A84C20' : '#151A24',
                      border: `1px solid ${workspaceType === t ? '#C9A84C' : '#1E2535'}`,
                      borderRadius: 10, padding: '10px 8px',
                      color: workspaceType === t ? '#C9A84C' : '#8A93A8',
                      fontSize: 11, fontWeight: 600,
                      letterSpacing: '1.5px', textTransform: 'uppercase',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {t === 'individual' ? 'Individual' : 'Equipe'}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div style={{
                background: '#E74C3C12', border: '1px solid #E74C3C30',
                borderRadius: 8, padding: '9px 12px', fontSize: 12,
                color: '#E74C3C', textAlign: 'center',
              }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || !workspaceName.trim()}
              style={{
                background: loading || !workspaceName.trim()
                  ? '#151A24'
                  : 'linear-gradient(135deg, #C9A84C, #6A5828)',
                border: `1px solid ${loading || !workspaceName.trim() ? '#1E2535' : '#C9A84C'}`,
                borderRadius: 10, padding: '13px',
                color: loading || !workspaceName.trim() ? '#8A93A8' : '#000',
                fontSize: 12, fontWeight: 800, letterSpacing: '2px',
                textTransform: 'uppercase',
                cursor: loading || !workspaceName.trim() ? 'not-allowed' : 'pointer',
                fontFamily: "'Georgia',serif",
                boxShadow: loading || !workspaceName.trim() ? 'none' : '0 0 20px #C9A84C28',
                transition: 'all 0.2s', width: '100%', marginTop: 4,
              }}
            >
              {loading ? '⟳ Criando...' : '✧ Criar workspace'}
            </button>
          </form>
        ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#C9A84C',
              letterSpacing: '2.5px', textTransform: 'uppercase',
              marginBottom: 8,
            }}>Email</div>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              autoComplete="email"
              style={{
                width: '100%',
                background: '#151A24',
                border: `1px solid ${error ? '#E74C3C60' : '#1E2535'}`,
                borderRadius: 10,
                padding: '12px 14px',
                color: '#DCE1EE',
                fontSize: 14,
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => {
                if (!error) e.target.style.borderColor = '#2A3348'
              }}
              onBlur={e => {
                if (!error) e.target.style.borderColor = '#1E2535'
              }}
            />
          </div>

          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#C9A84C',
              letterSpacing: '2.5px', textTransform: 'uppercase',
              marginBottom: 8,
            }}>Senha</div>
            <input
              ref={passwordRef}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{
                width: '100%',
                background: '#151A24',
                border: `1px solid ${error ? '#E74C3C60' : '#1E2535'}`,
                borderRadius: 10,
                padding: '12px 14px',
                color: '#DCE1EE',
                fontSize: 16,
                letterSpacing: 4,
                outline: 'none',
                fontFamily: 'monospace',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => {
                if (!error) e.target.style.borderColor = '#2A3348'
              }}
              onBlur={e => {
                if (!error) e.target.style.borderColor = '#1E2535'
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#E74C3C12',
              border: '1px solid #E74C3C30',
              borderRadius: 8,
              padding: '9px 12px',
              fontSize: 12,
              color: '#E74C3C',
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim() || !password.trim()}
            style={{
              background: loading || !email.trim() || !password.trim()
                ? '#151A24'
                : 'linear-gradient(135deg, #C9A84C, #6A5828)',
              border: `1px solid ${loading || !email.trim() || !password.trim() ? '#1E2535' : '#C9A84C'}`,
              borderRadius: 10,
              padding: '13px',
              color: loading || !email.trim() || !password.trim() ? '#8A93A8' : '#000',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              cursor: loading || !email.trim() || !password.trim() ? 'not-allowed' : 'pointer',
              fontFamily: "'Georgia',serif",
              boxShadow: loading || !email.trim() || !password.trim() ? 'none' : '0 0 20px #C9A84C28',
              transition: 'all 0.2s',
              width: '100%',
              marginTop: 4,
            }}
          >
            {loading ? '⟳ Entrando...' : '✝ Entrar'}
          </button>
        </form>
        )}

        <div style={{
          marginTop: 28,
          paddingTop: 18,
          borderTop: '1px solid #1E2535',
          textAlign: 'center',
          fontSize: 10,
          color: '#8A93A850',
          letterSpacing: '1px',
        }}>
          {step === 'login'
            ? 'Esqueceu a senha? Fale com o admin.'
            : 'Este é seu primeiro workspace. Você poderá criar outros depois.'}
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
