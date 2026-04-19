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
 * Variante pra buscar uma IMAGEM upstream (selectedOutput > url > sheetUrl/imageUrl).
 * Retorna null se não há conexão ou nenhum campo de imagem.
 *
 * Filtra pra considerar apenas edges cujo source produz tipo `image`
 * (Image Generator, Character, Scenario, Reference). Evita capturar
 * um VideoNode upstream quando o consumidor quer imagem.
 */
export function useUpstreamImage(nodeId: string): string | null {
  return useStore((state) => {
    const inbound = state.edges.filter(e => e.target === nodeId)
    for (const edge of inbound) {
      const src = state.nodeLookup.get(edge.source)
      if (!src) continue
      // Por convenção, Video nodes têm 'video' no type. Pula pra não confundir imagem com vídeo.
      if (src.type === 'video') continue
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
 * Variante pra buscar um VÍDEO upstream (outputs do Video Generator, ou
 * data.url legada). Só considera nodes do tipo 'video'. Permite
 * video-to-video e video-as-reference.
 */
export function useUpstreamVideo(nodeId: string): string | null {
  return useStore((state) => {
    const inbound = state.edges.filter(e => e.target === nodeId)
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
