'use client'

/**
 * /creators/avatar/new — criador dedicado de avatares.
 *
 * Wrappa o <AvatarCreator /> desacoplado (src/components/avatar/)
 * numa página de app router. Creator escolhe um personagem da
 * biblioteca, escreve o script, e gera um vídeo de avatar falante
 * usando o padrão AAZ (Character.description como identity anchor +
 * múltiplas refs + Seedance 2.0 omni_reference).
 *
 * Reusa exatamente o mesmo componente do AvatarNode do Workflow —
 * única lógica, superfícies múltiplas.
 */

import React, { useState } from 'react'
import Link from 'next/link'
import { C } from '@/components/studio/theme'
import { AvatarCreator } from '@/components/avatar/AvatarCreator'

export default function CreatorAvatarNew() {
  const [lastUrl, setLastUrl] = useState<string | null>(null)

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: 24 }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <Link href="/creators" style={{
            display: 'inline-block', marginBottom: 12,
            color: C.textDim, textDecoration: 'none', fontSize: 13,
          }}>
            ← Creators
          </Link>
          <h1 style={{
            fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: -0.5,
          }}>
            Novo avatar
          </h1>
          <p style={{ color: C.textDim, fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
            Selecione um personagem da biblioteca, escreva o que ele deve falar
            ou fazer, e gere um vídeo de avatar com voz e lip-sync. Usa o padrão
            AAZ — múltiplas referências + descrição canônica travam a identidade
            entre vídeos, ideal pra séries consistentes de Shorts/TikTok/Reels.
          </p>
        </div>

        {/* Card do criador */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: 20,
        }}>
          <AvatarCreator
            onGenerated={url => setLastUrl(url)}
            aspectRatios={['9:16', '16:9', '1:1']}
            durations={[5, 8, 10]}
            accent="#14B8A6"
          />
        </div>

        {lastUrl && (
          <div style={{
            marginTop: 16, padding: 12,
            background: '#14B8A615', border: '1px solid #14B8A655',
            borderRadius: 8, fontSize: 13, color: C.text,
          }}>
            ✓ Vídeo gerado. Faça download pra salvar ou gere outro variando o script.
          </div>
        )}
      </div>
    </div>
  )
}
