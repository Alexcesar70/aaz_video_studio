'use client'

/**
 * useAvatarGeneration — hook reusável pra geração de vídeo com
 * avatar/personagem, extraído da lógica de `AAZStudio.generate()`
 * (pattern que comprovadamente produz avatares fiéis).
 *
 * Decoupled de propósito:
 *   - Não conhece UI (sem state de formulário, sem modal, sem toast)
 *   - Não conhece wallet, history, ou episódio — caller trata
 *   - Stateless em relação à library de Characters — caller passa
 *     as refs já resolvidas (URLs + labels)
 *
 * Usado por:
 *   - Workflow: `AvatarNode` (substitui modo avatar do VideoNode)
 *   - Creators: painel "Novo Avatar"
 *   - AAZStudio (futuramente, substitui generate() inline)
 *
 * Padrão do payload espelha AAZStudio.generate() (L3517-3613):
 *   1. Substitui @Name/@charId por @imageN conforme posição nos
 *      reference_images
 *   2. Apenda "Referencing @video1 for motion..." / "Use @audio1..."
 *      ao fim do prompt se user não mencionou (padrão AAZ)
 *   3. Envia resolution explicito (engine.defaultResolution)
 *   4. NÃO escreve manifest prefix ("@image1 is the character...") —
 *      AAZ não faz isso e destrói fidelidade
 *
 * Fidelidade vem de:
 *   - Múltiplas refs por personagem (1-3) com a MESMA pessoa em
 *     poses/ângulos diferentes
 *   - Descrição canônica do sujeito DENTRO do prompt do user
 *     (tipicamente gerada pelo Scene Director — ver AAZStudio Scene
 *     Director block "Descrição Estática")
 *   - Tags @imageN bem-posicionadas no prompt
 */

import { useCallback, useState } from 'react'
import { pollJobUntilDone, type JobPollingView } from '@/lib/jobPolling'
import { getEngine, DEFAULT_ENGINE_ID } from '@/lib/videoEngines'

/** Uma imagem de referência, com opção de nome/charId pra substituição de tags. */
export interface AvatarRefImage {
  url: string
  /**
   * Nome do personagem (ex: "Abraão"). Usado pra substituir `@Abraão`
   * no prompt por `@imageN`. Opcional.
   */
  name?: string
  /**
   * ID do personagem (ex: "abraao"). Usado pra substituir `@abraao`
   * no prompt por `@imageN`. Opcional.
   */
  charId?: string
}

export interface AvatarGenerationInput {
  /** Texto cru do user — o que o avatar fala ou a cena a executar */
  prompt: string
  /** Imagens de referência em ordem — ordem vira @image1, @image2, etc */
  refImages: AvatarRefImage[]
  /** Videos de referência opcionais (motion, continuidade, voz) */
  refVideos?: string[]
  /** Audios de referência opcionais (voz/lip-sync) */
  refAudios?: string[]
  /** Engine (default seedance-2.0) */
  engineId?: string
  /** Duração em segundos (default 5) */
  duration?: number
  /** Aspect ratio CSS (default 9:16 — vertical pra Shorts/TikTok/Stories) */
  aspectRatio?: string
  /** Gerar áudio junto (default true) */
  generateAudio?: boolean
}

export type AvatarGenerationStatus = 'idle' | 'generating' | 'polling' | 'success' | 'error'

export interface UseAvatarGenerationResult {
  /** Dispara a geração. Resolve com URL do vídeo. */
  generate: (input: AvatarGenerationInput) => Promise<string>
  status: AvatarGenerationStatus
  statusMsg: string
  videoUrl: string | null
  error: string | null
  jobId: string | null
  /** Reseta estado (volta pra idle, limpa erro/vídeo) */
  reset: () => void
}

export function useAvatarGeneration(): UseAvatarGenerationResult {
  const [status, setStatus] = useState<AvatarGenerationStatus>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setStatusMsg('')
    setVideoUrl(null)
    setError(null)
    setJobId(null)
  }, [])

  const generate = useCallback(async (input: AvatarGenerationInput): Promise<string> => {
    const {
      prompt: rawPrompt,
      refImages,
      refVideos = [],
      refAudios = [],
      engineId = DEFAULT_ENGINE_ID,
      duration = 5,
      aspectRatio = '9:16',
      generateAudio = true,
    } = input

    if (!rawPrompt.trim()) {
      const err = 'Prompt vazio.'
      setStatus('error'); setError(err)
      throw new Error(err)
    }

    setStatus('generating')
    setStatusMsg('Enviando para Seedance...')
    setError(null)
    setVideoUrl(null)

    const engine = getEngine(engineId)

    // ── Substitui @Name/@charId por @imageN ──
    // Copia do AAZStudio.tsx:3562-3575. Essa é a etapa CRÍTICA que
    // casa o nome do personagem no prompt com a posição no array.
    let finalPrompt = rawPrompt
    refImages.forEach((r, i) => {
      const imgTag = `@image${i + 1}`
      if (r.name) {
        const escaped = r.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        finalPrompt = finalPrompt.replace(new RegExp(`@${escaped}\\b`, 'gi'), imgTag)
      }
      if (r.charId) {
        finalPrompt = finalPrompt.replace(new RegExp(`@${r.charId}\\b`, 'gi'), imgTag)
      }
    })

    // ── Hints apendados se user não mencionou @video/@audio ──
    // Copia literal do AAZStudio.tsx:3595-3608
    refVideos.forEach((_, i) => {
      const tag = `@Video${i + 1}`
      if (!finalPrompt.toLowerCase().includes(tag.toLowerCase())) {
        finalPrompt = `${finalPrompt} Referencing ${tag} for motion and scene continuity.`
      }
    })
    refAudios.forEach((_, i) => {
      const tag = `@Audio${i + 1}`
      if (!finalPrompt.toLowerCase().includes(tag.toLowerCase())) {
        finalPrompt = `${finalPrompt} Use ${tag} for audio reference.`
      }
    })

    const hasOmniRefs = refImages.length > 0 || refVideos.length > 0 || refAudios.length > 0

    const body: Record<string, unknown> = {
      engineId,
      prompt: finalPrompt,
      duration,
      aspect_ratio: aspectRatio,
      resolution: engine.defaultResolution,
      generate_audio: generateAudio,
      mode: hasOmniRefs ? 'omni_reference' : 'text_to_video',
    }

    if (hasOmniRefs) {
      if (refImages.length > 0) body.reference_images = refImages.map(r => r.url)
      if (refVideos.length > 0) body.reference_videos = refVideos
      if (refAudios.length > 0) body.reference_audios = refAudios
    }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e?.error || `Erro ${res.status}`)
      }
      const data = await res.json() as { videoUrl?: string; jobId?: string; async?: boolean }

      let url = data.videoUrl ?? ''
      if (!url && data.jobId) {
        setStatus('polling')
        setJobId(data.jobId)
        setStatusMsg(`Processando (job ${data.jobId.slice(0, 8)})...`)
        const finished = await pollJobUntilDone<{ videoUrl?: string }>(data.jobId, {
          onUpdate: (job: JobPollingView<{ videoUrl?: string }>) => {
            if (job.status === 'running') {
              const pct = typeof job.progress === 'number' ? ` ${job.progress}%` : ''
              setStatusMsg(`Gerando vídeo...${pct}`)
            }
          },
        })
        url = finished.output?.videoUrl ?? ''
      }

      if (!url) throw new Error('Servidor não retornou videoUrl.')

      setVideoUrl(url)
      setStatus('success')
      setStatusMsg('Vídeo gerado!')
      setJobId(null)
      return url
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido.'
      setStatus('error')
      setError(msg)
      setStatusMsg('')
      setJobId(null)
      throw err
    }
  }, [])

  return { generate, status, statusMsg, videoUrl, error, jobId, reset }
}
