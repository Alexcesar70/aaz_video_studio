'use client'

/**
 * AvatarCreator — componente completo pra gerar vídeo de avatar falante,
 * reusando a lógica do AAZStudio via useAvatarGeneration hook.
 *
 * Usado em:
 *   - Workflow: dentro do AvatarNode
 *   - Creators: como painel dedicado (/creators/avatar/new)
 *   - AAZStudio: eventualmente pode substituir o generate() inline
 *
 * Fluxo:
 *   1. User escolhe um Character (biblioteca) via CharacterPicker
 *   2. Escreve o script/ação no textarea (texto que o avatar vai falar
 *      ou descrição da cena)
 *   3. Ajusta aspect ratio e duração
 *   4. Clica Gerar → chama useAvatarGeneration → mostra preview
 *
 * Porque funciona melhor que foto-solta:
 *   - Character tem múltiplas imageUrls (até 3) que viram @image1,
 *     @image2, @image3 no prompt
 *   - Character tem description canônica ("homem ~45 anos, barba cheia,
 *     blazer azul") que entra no prompt final pra travar identidade
 *   - Caller pode prefixar o prompt com essa description antes de
 *     passar pro hook (opção `useCharacterDescription`, default true)
 */

import React, { useState } from 'react'
import type { Asset } from '@/lib/assets'
import { useAvatarGeneration, type AvatarRefImage } from './useAvatarGeneration'
import { CharacterPicker } from './CharacterPicker'

export interface AvatarCreatorProps {
  /** Character inicial pré-selecionado (opcional) */
  initialCharacter?: Asset | null
  /** Prompt/script inicial */
  initialPrompt?: string
  /** Callback chamado quando o vídeo termina de gerar */
  onGenerated?: (videoUrl: string) => void
  /** Layout compacto (pra usar dentro de nó do Workflow) */
  compact?: boolean
  /** Accent color (default roxo image) */
  accent?: string
  /** Aspect ratios oferecidos (default ['9:16', '16:9', '1:1']) */
  aspectRatios?: string[]
  /** Durações oferecidas em segundos (default [5, 8, 10]) */
  durations?: number[]
}

const C = {
  bg: '#0F0D1A',
  surface: '#1A1628',
  border: '#3A3555',
  text: '#E8E5F0',
  textDim: '#9F9AB8',
  textFaint: '#6B6688',
}

export function AvatarCreator({
  initialCharacter = null,
  initialPrompt = '',
  onGenerated,
  compact = false,
  accent = '#8B5CF6',
  aspectRatios = ['9:16', '16:9', '1:1'],
  durations = [5, 8, 10],
}: AvatarCreatorProps) {
  const [character, setCharacter] = useState<Asset | null>(initialCharacter)
  const [prompt, setPrompt] = useState(initialPrompt)
  const [aspectRatio, setAspectRatio] = useState(aspectRatios[0])
  const [duration, setDuration] = useState(durations[0])

  const { generate, status, statusMsg, videoUrl, error, reset } = useAvatarGeneration()
  const isGenerating = status === 'generating' || status === 'polling'
  const canRun = !!character && prompt.trim().length > 0 && !isGenerating

  const handleRun = async () => {
    if (!character) return
    try {
      // Monta refImages a partir das imageUrls do Character.
      // Usa até 3 imagens (AAZ faz assim — mais que 3 não melhora fidelidade).
      const refImages: AvatarRefImage[] = (character.imageUrls ?? [])
        .slice(0, 3)
        .map(url => ({
          url,
          name: character.name,
          charId: character.id,
        }))

      // Prefixa a descrição canônica do Character ao prompt user.
      // Isso é o equivalente ao bloco "Descrição Estática" do Scene
      // Director — trava a identidade visual.
      const scopedPrompt = character.description
        ? `${character.description}. ${prompt}`
        : prompt

      const url = await generate({
        prompt: scopedPrompt,
        refImages,
        aspectRatio,
        duration,
        generateAudio: true,
      })
      onGenerated?.(url)
    } catch {
      // hook já guardou o erro em `error`
    }
  }

  const textareaHeight = compact ? 80 : 120

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 10,
      color: C.text, fontFamily: 'inherit', fontSize: 12,
    }}>
      {/* 1. Character picker */}
      <div>
        <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4, letterSpacing: 0.3, textTransform: 'uppercase' }}>
          Personagem
        </div>
        <CharacterPicker
          value={character?.id ?? null}
          onChange={setCharacter}
          accent={accent}
          compact={compact}
        />
      </div>

      {/* 2. Prompt/script */}
      <div>
        <div style={{ fontSize: 10, color: C.textDim, marginBottom: 4, letterSpacing: 0.3, textTransform: 'uppercase' }}>
          Script / Ação
        </div>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder={character
            ? `Ex: ${character.name} diz "olá, bem-vindo ao canal", olhando pra câmera, sorriso firme, corte seco no primeiro frame`
            : 'Selecione um personagem primeiro…'}
          disabled={!character || isGenerating}
          style={{
            width: '100%', minHeight: textareaHeight, padding: 8,
            background: C.bg, border: `1px solid ${C.border}`,
            borderRadius: 6, color: C.text, fontSize: 12,
            fontFamily: 'inherit', resize: 'vertical', outline: 'none',
            lineHeight: 1.45,
          }}
        />
      </div>

      {/* 3. Controles de formato */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {aspectRatios.map(ar => (
            <button
              key={ar}
              onClick={() => setAspectRatio(ar)}
              disabled={isGenerating}
              style={{
                padding: '4px 10px', borderRadius: 4,
                background: aspectRatio === ar ? `${accent}25` : 'transparent',
                border: `1px solid ${aspectRatio === ar ? accent : C.border}`,
                color: aspectRatio === ar ? accent : C.textDim,
                fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
                cursor: isGenerating ? 'default' : 'pointer',
              }}
            >
              {ar}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {durations.map(d => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              disabled={isGenerating}
              style={{
                padding: '4px 10px', borderRadius: 4,
                background: duration === d ? `${accent}25` : 'transparent',
                border: `1px solid ${duration === d ? accent : C.border}`,
                color: duration === d ? accent : C.textDim,
                fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
                cursor: isGenerating ? 'default' : 'pointer',
              }}
            >
              {d}s
            </button>
          ))}
        </div>
      </div>

      {/* 4. Botão Gerar + Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => void handleRun()}
          disabled={!canRun}
          style={{
            padding: '8px 16px', borderRadius: 6,
            background: canRun ? accent : C.border,
            border: 'none',
            color: canRun ? '#0A0814' : C.textFaint,
            fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
            cursor: canRun ? 'pointer' : 'default',
          }}
        >
          {isGenerating ? 'Gerando…' : 'Gerar avatar'}
        </button>
        {isGenerating && (
          <span style={{ fontSize: 11, color: accent }}>{statusMsg}</span>
        )}
        {error && (
          <span style={{ fontSize: 11, color: '#ff5d7a' }}>{error}</span>
        )}
      </div>

      {/* 5. Preview do vídeo gerado */}
      {videoUrl && (
        <div style={{
          padding: 8, background: C.bg,
          border: `1px solid ${accent}55`, borderRadius: 8,
        }}>
          <video
            src={videoUrl}
            controls
            playsInline
            style={{
              width: '100%', maxHeight: compact ? 240 : 400,
              borderRadius: 4, background: '#000',
            }}
          />
          <div style={{
            display: 'flex', gap: 6, marginTop: 6,
          }}>
            <a
              href={videoUrl}
              download="avatar.mp4"
              target="_blank"
              rel="noopener"
              style={{
                flex: 1, textAlign: 'center',
                padding: '6px 8px', borderRadius: 4,
                background: `${accent}25`,
                border: `1px solid ${accent}66`,
                color: accent, fontSize: 10, fontWeight: 600,
                textDecoration: 'none', fontFamily: 'inherit',
              }}
            >
              Baixar
            </a>
            <button
              onClick={reset}
              style={{
                padding: '6px 12px', borderRadius: 4,
                background: 'transparent',
                border: `1px solid ${C.border}`,
                color: C.textDim, fontSize: 10, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Novo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
