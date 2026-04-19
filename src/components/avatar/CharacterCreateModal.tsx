'use client'

/**
 * CharacterCreateModal — modal pra criar Character custom do workspace.
 *
 * Duas formas de adicionar fotos:
 *   1. Upload: arrastar/escolher 1-3 fotos do disco (Vercel Blob direct)
 *   2. Gerar com IA: descrever e gerar com Nano Banana Pro, selecionar
 *      as que ficaram boas
 *
 * Campos comuns:
 *   - Nome (obrigatório)
 *   - Descrição curta (recomendado — é o bloco "Descrição Estática"
 *     que trava identidade no Seedance e acompanha o Character em
 *     TODA geração de vídeo/avatar)
 *
 * Persistência: POST /api/assets { type: 'character', name, description,
 * imageUrls[] } — endpoint existente, cria Character custom scoped no
 * workspace. Fica disponível no Workflow (AvatarNode, ImageNode,
 * CharacterNode) e em Creators.
 *
 * Uma implementação, dois lugares de uso — reusa via CharacterPicker.
 */

import React, { useState } from 'react'
import { upload } from '@vercel/blob/client'
import type { Asset } from '@/lib/assets'

export interface CharacterCreateModalProps {
  open: boolean
  onClose: () => void
  onCreated: (asset: Asset) => void
  accent?: string
}

const C = {
  overlay: 'rgba(5, 4, 15, 0.75)',
  bg: '#0F0D1A',
  surface: '#1A1628',
  surfaceHi: '#221F35',
  border: '#3A3555',
  text: '#E8E5F0',
  textDim: '#9F9AB8',
  textFaint: '#6B6688',
  danger: '#ff5d7a',
}

const MAX_IMAGES = 3

export function CharacterCreateModal({
  open,
  onClose,
  onCreated,
  accent = '#14B8A6',
}: CharacterCreateModalProps) {
  const [tab, setTab] = useState<'upload' | 'ai'>('upload')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Upload state
  const [uploading, setUploading] = useState(false)

  // AI state
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiResults, setAiResults] = useState<string[]>([])

  if (!open) return null

  const canSave = name.trim().length > 0 && imageUrls.length > 0 && !saving

  const resetAll = () => {
    setName(''); setDescription(''); setImageUrls([])
    setAiPrompt(''); setAiResults([])
    setTab('upload'); setError(null)
  }

  const handleClose = () => {
    if (saving || uploading || aiGenerating) return
    resetAll()
    onClose()
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const slotsLeft = MAX_IMAGES - imageUrls.length
    if (slotsLeft <= 0) {
      setError(`Máximo ${MAX_IMAGES} imagens.`)
      return
    }
    const picked = Array.from(files).slice(0, slotsLeft)
    setUploading(true)
    setError(null)
    try {
      const urls: string[] = []
      for (const file of picked) {
        if (file.size > 50 * 1024 * 1024) {
          setError(`"${file.name}" excede 50MB.`)
          continue
        }
        const pathname = `char-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const blob = await upload(pathname, file, {
          access: 'public',
          handleUploadUrl: '/api/workflow/upload',
          contentType: file.type || undefined,
        })
        urls.push(blob.url)
      }
      setImageUrls(prev => [...prev, ...urls].slice(0, MAX_IMAGES))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no upload.')
    } finally {
      setUploading(false)
    }
  }

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || aiGenerating) return
    setAiGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          num_outputs: 4,
          aspect_ratio: '1:1',
          engineId: 'nano-banana-pro',
        }),
      })
      const data = await res.json() as { imageUrls?: string[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Falha ao gerar.')
      setAiResults(data.imageUrls ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro.')
    } finally {
      setAiGenerating(false)
    }
  }

  const toggleAiSelect = (url: string) => {
    setImageUrls(prev => {
      if (prev.includes(url)) return prev.filter(u => u !== url)
      if (prev.length >= MAX_IMAGES) return prev
      return [...prev, url]
    })
  }

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'character',
          name: name.trim(),
          description: description.trim(),
          imageUrls,
        }),
      })
      const data = await res.json() as { asset?: Asset; error?: string }
      if (!res.ok || !data.asset) throw new Error(data.error ?? 'Erro ao salvar.')
      onCreated(data.asset)
      resetAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro.')
    } finally {
      setSaving(false)
    }
  }

  const removeImage = (url: string) => {
    setImageUrls(prev => prev.filter(u => u !== url))
  }

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: C.overlay, backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 640, maxHeight: '90vh',
          background: C.bg, border: `1px solid ${C.border}`,
          borderRadius: 12, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', color: C.text,
          fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: `1px solid ${C.border}`,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Novo personagem</div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
              Fica salvo na sua biblioteca e disponível no Workflow e Creators.
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'transparent', border: 'none', color: C.textDim,
              fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: 4,
            }}
          >×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '12px 20px 0' }}>
          {([
            { id: 'upload', label: 'Enviar fotos' },
            { id: 'ai', label: 'Gerar com IA' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 14px', borderRadius: 8,
                background: tab === t.id ? C.surfaceHi : 'transparent',
                border: tab === t.id ? `1px solid ${C.border}` : '1px solid transparent',
                color: tab === t.id ? C.text : C.textDim,
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {tab === 'upload' ? (
            <div>
              <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>
                Até {MAX_IMAGES} fotos (1 basta; 2-3 melhora fidelidade).
              </div>
              <label
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minHeight: 100, padding: 16,
                  background: C.surface, border: `1px dashed ${C.border}`,
                  borderRadius: 8, color: C.textDim, fontSize: 13,
                  cursor: uploading || imageUrls.length >= MAX_IMAGES ? 'default' : 'pointer',
                  opacity: imageUrls.length >= MAX_IMAGES ? 0.5 : 1,
                }}
              >
                {uploading
                  ? 'Enviando...'
                  : imageUrls.length >= MAX_IMAGES
                    ? `Máximo ${MAX_IMAGES} atingido`
                    : '📁 Clique ou arraste fotos (máx 50MB cada)'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={e => void handleFiles(e.target.files)}
                  disabled={uploading || imageUrls.length >= MAX_IMAGES}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>
                Descreva o personagem com detalhes (altura, cabelo, roupa, olhar…)
              </div>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="Ex: Homem 45 anos, barba cheia grisalha, blazer azul-marinho sobre camisa preta, olhar firme, fundo neutro"
                disabled={aiGenerating}
                style={{
                  width: '100%', minHeight: 80, padding: 10,
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 6, color: C.text, fontSize: 12,
                  fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                }}
              />
              <button
                onClick={() => void handleAiGenerate()}
                disabled={!aiPrompt.trim() || aiGenerating}
                style={{
                  marginTop: 8, padding: '8px 16px', borderRadius: 6,
                  background: aiPrompt.trim() && !aiGenerating ? accent : C.border,
                  border: 'none',
                  color: aiPrompt.trim() && !aiGenerating ? '#0A0814' : C.textFaint,
                  fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                  cursor: aiPrompt.trim() && !aiGenerating ? 'pointer' : 'default',
                }}
              >
                {aiGenerating ? 'Gerando...' : 'Gerar 4 imagens'}
              </button>

              {aiResults.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>
                    Clique pra selecionar as que ficaram boas (até {MAX_IMAGES}).
                  </div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
                  }}>
                    {aiResults.map(url => {
                      const selected = imageUrls.includes(url)
                      return (
                        <button
                          key={url}
                          onClick={() => toggleAiSelect(url)}
                          style={{
                            padding: 0, background: 'transparent',
                            border: `2px solid ${selected ? accent : 'transparent'}`,
                            borderRadius: 6, cursor: 'pointer',
                            position: 'relative', aspectRatio: '1',
                            overflow: 'hidden',
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url} alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                          {selected && (
                            <div style={{
                              position: 'absolute', top: 4, right: 4,
                              width: 20, height: 20, borderRadius: '50%',
                              background: accent, color: '#0A0814',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 700,
                            }}>✓</div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Imagens selecionadas (comum às duas abas) */}
          {imageUrls.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>
                Imagens do personagem ({imageUrls.length}/{MAX_IMAGES})
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {imageUrls.map(url => (
                  <div
                    key={url}
                    style={{
                      width: 64, height: 64, borderRadius: 6,
                      border: `1px solid ${accent}66`, position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url} alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <button
                      onClick={() => removeImage(url)}
                      title="Remover"
                      style={{
                        position: 'absolute', top: 2, right: 2,
                        width: 18, height: 18, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.7)', border: 'none',
                        color: '#fff', fontSize: 12, lineHeight: 1,
                        cursor: 'pointer',
                      }}
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nome + Descrição */}
          <div style={{
            marginTop: 20, paddingTop: 16,
            borderTop: `1px solid ${C.border}`,
          }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: C.textDim, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 4 }}>
                Nome
              </div>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Abraão, Eu (Alex), Maria Tech"
                style={{
                  width: '100%', padding: '8px 10px',
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 6, color: C.text, fontSize: 13,
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.textDim, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 4 }}>
                Descrição canônica
                <span style={{ color: C.textFaint, textTransform: 'none', letterSpacing: 0, marginLeft: 6, fontSize: 9 }}>
                  (vai em TODA geração de vídeo — trava identidade)
                </span>
              </div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Ex: Homem 45 anos, barba cheia grisalha, cabelo curto escuro, blazer azul-marinho sobre camisa preta, olhar sereno e direto"
                style={{
                  width: '100%', minHeight: 60, padding: 10,
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 6, color: C.text, fontSize: 12,
                  fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                  lineHeight: 1.4,
                }}
              />
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: 12, padding: '8px 12px', borderRadius: 6,
              background: `${C.danger}15`, border: `1px solid ${C.danger}33`,
              color: C.danger, fontSize: 12,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 8, justifyContent: 'flex-end',
          padding: '12px 20px', borderTop: `1px solid ${C.border}`,
        }}>
          <button
            onClick={handleClose}
            disabled={saving || uploading || aiGenerating}
            style={{
              padding: '8px 16px', borderRadius: 6,
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.textDim, fontSize: 12, fontWeight: 600,
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={!canSave}
            style={{
              padding: '8px 20px', borderRadius: 6,
              background: canSave ? accent : C.border, border: 'none',
              color: canSave ? '#0A0814' : C.textFaint,
              fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
              cursor: canSave ? 'pointer' : 'default',
            }}
          >
            {saving ? 'Salvando...' : 'Salvar personagem'}
          </button>
        </div>
      </div>
    </div>
  )
}
