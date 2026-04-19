'use client'

import React, { useRef, useState } from 'react'
import { UIIcons, DEFAULT_ICON_PROPS } from '../../theme/icons'
import { wfColors, wfRadius } from '../../theme/workflowTheme'

/**
 * Botão de upload — abre seletor de arquivo, envia pro /api/blob-upload
 * e chama `onUploaded(url)` com a URL pública resultante. Suporta filtro
 * de mime type via prop `accept`.
 *
 * Single-responsibility: só gerencia o upload. Não desenha preview nem
 * persiste estado — delega pro pai.
 */

export interface UploadControlProps {
  onUploaded: (url: string) => void
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

  const onFilePicked = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0]
    ev.target.value = ''
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/blob-upload', { method: 'POST', body: formData })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Falha no upload.')
        return
      }
      onUploaded(data.url)
    } catch {
      setError('Erro de conexão.')
    } finally {
      setUploading(false)
    }
  }

  const color = hasValue ? accent : wfColors.textDim

  return (
    <>
      <button
        onClick={openPicker}
        disabled={disabled || uploading}
        title={error ?? title}
        className="nodrag"
        style={{
          width: 22, height: 22, padding: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: hasValue ? `${accent}25` : 'transparent',
          border: `1px solid ${hasValue ? `${accent}55` : wfColors.border}`,
          borderRadius: wfRadius.control,
          color: error ? '#ff5d7a' : color,
          cursor: disabled || uploading ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {uploading ? (
          <span style={{ fontSize: 9 }}>…</span>
        ) : (
          <UIIcons.attach size={11} {...DEFAULT_ICON_PROPS} />
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onFilePicked}
        style={{ display: 'none' }}
      />
    </>
  )
}
