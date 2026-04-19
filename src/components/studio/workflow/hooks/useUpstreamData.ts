'use client'

import { useStore } from '@xyflow/react'

/**
 * Hook reativo: lê o texto do nó upstream conectado à entrada do nó
 * indicado por `nodeId`. Usa `useStore` do xyflow pra subscrever a
 * mudanças em edges e nodes — re-renderiza automaticamente quando
 * alguém conecta/desconecta ou o texto upstream muda.
 *
 * Faz BFS limitado (até 5 hops) seguindo edges upstream pra encontrar
 * o primeiro texto concreto disponível. Isso permite "passthrough"
 * automático: quando user conecta Texto → SmartPrompter → Vídeo SEM
 * clicar Refinar, o Vídeo ainda recebe o texto cru do TextNode (em
 * vez de ficar disabled silenciosamente esperando o refinamento).
 *
 * Em cada source, procura (em ordem): refinedPrompt > text > prompt.
 *
 * Retorna null se nenhum hop ate maxHops trouxe texto compatível.
 */
export function useUpstreamText(nodeId: string, maxHops = 5): string | null {
  return useStore((state) => {
    const visited = new Set<string>([nodeId])
    let current = nodeId

    for (let hop = 0; hop < maxHops; hop++) {
      const inbound = state.edges.filter(e => e.target === current)
      if (inbound.length === 0) return null
      const sourceId = inbound[0].source
      if (visited.has(sourceId)) return null
      visited.add(sourceId)

      const src = state.nodeLookup.get(sourceId)
      if (!src) return null

      const d = src.data as Record<string, unknown>
      const text = (d.refinedPrompt as string)
        ?? (d.text as string)
        ?? (d.prompt as string)
        ?? null
      if (text && text.trim().length > 0) return text

      // Sem texto neste source — segue pro upstream dele
      current = sourceId
    }
    return null
  })
}

/**
 * Lê imagem upstream conectada a um handle específico (via `handleId`)
 * ou, se omitido, ao primeiro input do nó. Ignora sources do tipo
 * 'video' — se quer video, use `useUpstreamVideo`.
 *
 * @param nodeId - id do nó consumidor
 * @param handleId - id do handle alvo (ex: 'start', 'end'). Omitir
 *                  pega primeiro input compatível.
 */
export function useUpstreamImage(nodeId: string, handleId?: string): string | null {
  return useStore((state) => {
    const inbound = state.edges.filter(e =>
      e.target === nodeId && (handleId ? e.targetHandle === handleId : true),
    )
    for (const edge of inbound) {
      const src = state.nodeLookup.get(edge.source)
      if (!src) continue
      if (src.type === 'video') continue // pula videos
      const d = src.data as Record<string, unknown>
      const outputs = d.outputs as Array<{ url: string }> | undefined
      const selectedIndex = (d.selectedIndex as number) ?? 0
      const fromOutputs = outputs?.[selectedIndex]?.url
      const found = fromOutputs
        ?? (d.url as string)
        ?? (d.sheetUrl as string)
        ?? (d.imageUrl as string)
      if (found) return found
    }
    return null
  })
}

/**
 * Lê vídeo upstream conectado a um handle específico (ou ao primeiro).
 * Só considera nós do tipo 'video'. Permite video-to-video e
 * video-as-reference.
 */
export function useUpstreamVideo(nodeId: string, handleId?: string): string | null {
  return useStore((state) => {
    const inbound = state.edges.filter(e =>
      e.target === nodeId && (handleId ? e.targetHandle === handleId : true),
    )
    for (const edge of inbound) {
      const src = state.nodeLookup.get(edge.source)
      if (!src || src.type !== 'video') continue
      const d = src.data as Record<string, unknown>
      const outputs = d.outputs as Array<{ url: string }> | undefined
      const selectedIndex = (d.selectedIndex as number) ?? 0
      const fromOutputs = outputs?.[selectedIndex]?.url
      const found = fromOutputs ?? (d.url as string)
      if (found) return found
    }
    return null
  })
}

/**
 * Lê áudio upstream conectado a um handle (ou ao primeiro). Considera
 * nós do tipo 'audio' — usado pra trilha/narração em VideoGenerator.
 */
export function useUpstreamAudio(nodeId: string, handleId?: string): string | null {
  return useStore((state) => {
    const inbound = state.edges.filter(e =>
      e.target === nodeId && (handleId ? e.targetHandle === handleId : true),
    )
    for (const edge of inbound) {
      const src = state.nodeLookup.get(edge.source)
      if (!src || src.type !== 'audio') continue
      const d = src.data as Record<string, unknown>
      const found = (d.url as string) ?? (d.musicUrl as string)
      if (found) return found
    }
    return null
  })
}
