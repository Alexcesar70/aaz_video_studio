'use client'
import React, { useMemo, useState } from 'react'
import { useWorkflow } from '../WorkflowContext'
import { NodeShell } from '../components/NodeShell'
import { NodeHeader } from '../components/NodeHeader'
import { NodeFrame } from '../components/NodeFrame'
import { UploadControl } from '../components/controls/UploadControl'
import { standardNodeActions, openLinkAction, downloadAction } from '../components/nodeActions'
import { getNodeTypeMeta } from '../theme/nodeTypeMeta'
import { ActionIcons, NODE_TYPE_ICONS, DEFAULT_ICON_PROPS } from '../theme/icons'
import { wfColors, wfRadius } from '../theme/workflowTheme'
import type { NodeAction } from '../components/NodeActionsToolbar'
import type { DataType } from '../theme/nodeTypeMeta'

/**
 * Reference Node — peça central pra trazer asset externo pro canvas:
 * upload de foto de avatar, clipe de referência, URL externa, etc.
 *
 * Usuário escolhe como popular:
 *   1. Upload direto (image/* ou video/* — até 50MB)
 *   2. Cole URL externa
 *
 * Output é tipado dinamicamente de acordo com o que foi subido:
 *   - imagem     → output tipo 'image'  (alimenta Image/Video Gen)
 *   - video      → output tipo 'video'  (alimenta Video Gen)
 *   - url genérica → output tipo 'any'  (aceita em qualquer lugar)
 *
 * Preview embedded (img ou video player) dentro do card.
 */

type RefKind = 'image' | 'video' | 'link'

function inferKindFromUrl(url: string | undefined): RefKind {
  if (!url) return 'link'
  const lower = url.toLowerCase().split('?')[0]
  if (/\.(png|jpe?g|webp|gif|heic|heif|avif|bmp)$/.test(lower)) return 'image'
  if (/\.(mp4|mov|webm|m4v|avi|mkv)$/.test(lower)) return 'video'
  return 'link'
}

export function ReferenceNode({ id, data, selected }: { id: string; data: Record<string, unknown>; selected: boolean }) {
  const { updateNode, duplicateNode, deleteNode } = useWorkflow()
  const url = data.url as string | undefined
  const label = (data.label as string) ?? ''
  const accent = (data.color as string) || getNodeTypeMeta('reference').color

  // Kind explícito salvo pelo upload; fallback: infere da URL
  const storedKind = data.kind as RefKind | undefined
  const kind: RefKind = storedKind ?? inferKindFromUrl(url)

  const outputType: DataType =
    kind === 'image' ? 'image' : kind === 'video' ? 'video' : 'any'

  const [editingUrl, setEditingUrl] = useState(false)
  const [draftUrl, setDraftUrl] = useState(url ?? '')
  const [draftLabel, setDraftLabel] = useState(label)

  const patchContent = (patch: Record<string, unknown>) => {
    updateNode(id, { content: patch })
  }

  const saveUrl = () => {
    setEditingUrl(false)
    const trimmed = draftUrl.trim()
    if (!trimmed) return
    patchContent({
      url: trimmed,
      kind: inferKindFromUrl(trimmed),
      label: draftLabel || label,
    })
  }

  const handleUploaded = (uploadedUrl: string) => {
    const detected = inferKindFromUrl(uploadedUrl)
    patchContent({ url: uploadedUrl, kind: detected })
  }

  const openAction = openLinkAction(url)
  const filename = label
    ? `${label}.${kind === 'video' ? 'mp4' : kind === 'image' ? 'jpg' : 'file'}`
    : `reference.${kind === 'video' ? 'mp4' : kind === 'image' ? 'jpg' : 'file'}`

  const actions: NodeAction[] = useMemo(() => [
    {
      id: 'edit-url',
      icon: <ActionIcons.editUrl size={9} {...DEFAULT_ICON_PROPS} />,
      title: 'Editar URL',
      onClick: () => setEditingUrl(true),
    },
    ...(downloadAction(url, filename) ? [downloadAction(url, filename)!] : []),
    ...(openAction ? [openAction] : []),
    ...standardNodeActions(id, { duplicateNode, deleteNode }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [id, url, openAction, filename])

  const hasContent = Boolean(url)

  return (
    <NodeFrame
      outputs={[{ dataType: outputType }]}
      actions={actions}
    >
      <NodeShell type="reference" selected={selected} colorOverride={accent} width={260} flush>
        <div style={{ padding: '10px 12px 6px' }}>
          <NodeHeader
            type="reference"
            accent={accent}
            label={label || undefined}
            right={hasContent ? (
              <span style={{ fontSize: 10, color: wfColors.textDim, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {kind}
              </span>
            ) : undefined}
          />
        </div>

        {/* Preview */}
        <div style={{
          aspectRatio: kind === 'video' ? '16/9' : '1/1',
          background: wfColors.surfaceDeep,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderTop: `1px solid ${wfColors.border}`,
          borderBottom: `1px solid ${wfColors.border}`,
          overflow: 'hidden',
        }}>
          {kind === 'image' && url && (
            <img src={url} alt={label || 'Referência'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
          {kind === 'video' && url && (
            <video
              src={url}
              controls
              playsInline
              className="nodrag nowheel"
              style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
            />
          )}
          {!hasContent && (() => {
            const I = NODE_TYPE_ICONS.reference
            return <I size={26} color={wfColors.textFaint} strokeWidth={1.25} />
          })()}
          {kind === 'link' && hasContent && (() => {
            const I = NODE_TYPE_ICONS.reference
            return (
              <div style={{ padding: '8px 10px', textAlign: 'center' }}>
                <I size={22} color={accent} strokeWidth={1.5} />
                <div style={{ fontSize: 10, color: wfColors.textDim, marginTop: 6, wordBreak: 'break-all' }}>
                  {url!.length > 40 ? url!.slice(0, 40) + '…' : url}
                </div>
              </div>
            )
          })()}
        </div>

        {/* Controles */}
        <div className="nodrag" style={{
          padding: '8px 12px 10px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <UploadControl
            accept="image/*,video/*"
            onUploaded={handleUploaded}
            hasValue={hasContent}
            accent={accent}
            title={hasContent ? 'Trocar arquivo' : 'Upload de imagem ou vídeo (até 50MB)'}
          />
          <button
            onClick={() => setEditingUrl(true)}
            title="Colar URL externa"
            className="nodrag"
            style={{
              height: 22, padding: '0 10px', fontSize: 10, fontFamily: 'inherit',
              background: 'transparent', border: `1px solid ${wfColors.border}`,
              borderRadius: wfRadius.control, color: wfColors.textDim,
              cursor: 'pointer',
            }}
          >
            URL
          </button>
          {editingUrl && (
            <div
              style={{
                position: 'absolute', inset: 0, zIndex: 5,
                background: `${wfColors.surface}E8`, backdropFilter: 'blur(6px)',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                padding: 14, gap: 6,
              }}
              className="nodrag"
            >
              <input
                value={draftUrl}
                onChange={e => setDraftUrl(e.target.value)}
                placeholder="URL da imagem ou vídeo"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') saveUrl()
                  if (e.key === 'Escape') setEditingUrl(false)
                }}
                style={inputStyle}
              />
              <input
                value={draftLabel}
                onChange={e => setDraftLabel(e.target.value)}
                placeholder="Rótulo (opcional)"
                style={inputStyle}
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                <button
                  onClick={saveUrl}
                  style={{
                    flex: 1, height: 24, fontSize: 11, fontWeight: 600,
                    background: accent, border: 'none', borderRadius: wfRadius.control,
                    color: '#0A0814', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >Salvar</button>
                <button
                  onClick={() => setEditingUrl(false)}
                  style={{
                    height: 24, padding: '0 10px', fontSize: 11,
                    background: 'transparent', border: `1px solid ${wfColors.border}`,
                    borderRadius: wfRadius.control, color: wfColors.textDim,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >Cancelar</button>
              </div>
            </div>
          )}
        </div>
      </NodeShell>
    </NodeFrame>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', borderRadius: wfRadius.control,
  background: wfColors.surfaceDeep, border: `1px solid ${wfColors.border}`,
  color: wfColors.text, fontSize: 11, fontFamily: 'inherit', outline: 'none',
}
