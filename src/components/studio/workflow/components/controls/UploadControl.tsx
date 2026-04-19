'use client'

import React, { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { UIIcons, DEFAULT_ICON_PROPS } from '../../theme/icons'
import { wfColors, wfRadius } from '../../theme/workflowTheme'

/**
 * Botão de upload — usa client-side upload do Vercel Blob (bypass do
 * limite 4.5MB dos endpoints serverless). Suporta até 50MB.
 *
 * O endpoint `/api/workflow/upload` só emite o token; o arquivo vai
 * direto do browser pro Blob. Após completar, chama `onUploaded(url)`
 * com a URL pública.
 *
 * Single-responsibility: gerencia picker + progresso + erro. Não
 * renderiza preview nem persiste estado — delega pro pai.
 *
 * Exibe erro inline por 4s (não só em tooltip) pra que o usuário
 * saiba o que deu errado.
 */

export interface UploadControlProps {
  onUploaded: (url: string) => void
  /** Mime types aceitos (accept do input). Ex: "image/*", "video/*", "image/*,video/*" */
  accept?: string
  title?: string
  disabled?: boolean
  /** Indicativo visual se já há algo subido (ex: ícone em cor de accent) */
  hasValue?: boolean
  accent?: string
}

export function UploadControl({
  onUploaded,
  accept = 'image/*',
  title = 'Upload',
  disabled = false,
  hasValue = false,
  accent = wfColors.edgeDefault,
}: UploadControlProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const openPicker = () => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  const showError = (msg: string) => {
    setError(msg)
    setTimeout(() => setError(null), 4000)
  }

  const onFilePicked = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return

    // Validação client-side pra dar feedback imediato
    const MAX_BYTES = 50 * 1024 * 1024
    if (file.size > MAX_BYTES) {
      showError(`Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo 50MB.`)
      return
    }

    setUploading(true)
    setError(null)
    try {
      const pathname = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const blob = await upload(pathname, file, {
        access: 'public',
        handleUploadUrl: '/api/workflow/upload',
        contentType: file.type || undefined,
      })
      onUploaded(blob.url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha no upload.'
      showError(msg.length > 60 ? msg.slice(0, 60) + '…' : msg)
    } finally {
      setUploading(false)
    }
  }

  const iconColor = hasValue ? accent : wfColors.textDim

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={openPicker}
        disabled={disabled || uploading}
        title={title}
        className="nodrag"
        style={{
          width: 22, height: 22, padding: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          // Sempre com background leve + borda de accent pra ficar visível,
          // mesmo sem value (antes estava transparente e passava despercebido).
          background: hasValue ? `${accent}35` : `${accent}15`,
          border: `1px solid ${error ? '#ff5d7a' : hasValue ? accent : `${accent}55`}`,
          borderRadius: wfRadius.control,
          color: error ? '#ff5d7a' : accent,
          cursor: disabled || uploading ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {uploading ? (
          <span style={{ fontSize: 9 }}>…</span>
        ) : (
          <UIIcons.attach size={9} {...DEFAULT_ICON_PROPS} />
        )}
      </button>

      {/* Tooltip de erro — aparece por 4s no topo, bem visível */}
      {error && (
        <div
          role="alert"
          style={{
            position: 'absolute', bottom: 'calc(100% + 6px)', left: 0,
            whiteSpace: 'nowrap', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis',
            padding: '4px 8px', borderRadius: wfRadius.control,
            background: '#ff5d7a', color: '#fff',
            fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            pointerEvents: 'none', zIndex: 50,
          }}
        >
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onFilePicked}
        style={{ display: 'none' }}
      />
    </div>
  )
}
