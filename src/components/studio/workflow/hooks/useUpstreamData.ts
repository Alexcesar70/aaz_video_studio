'use client'

import { useStore } from '@xyflow/react'

/**
 * Hook reativo: lê o texto do nó upstream conectado à entrada do nó
 * indicado por `nodeId`. Usa `useStore` do xyflow pra subscrever a
 * mudanças em edges e nodes — re-renderiza automaticamente quando
 * alguém conecta/desconecta ou o texto upstream muda.
 *
 * Procura na data do source por (em ordem):
 * - `refinedPrompt` (saída de SmartPrompter)
 * - `text` (saída de TextNode/NoteNode)
 * - `prompt` (saída de outros nós com prompt)
 *
 * Retorna null se não há conexão ou nenhum campo compatível.
 *
 * Reutilizável em qualquer nó que consome texto upstream
 * (SmartPrompter, ImageGenerator, VideoGenerator, Assistant).
 */
export function useUpstreamText(nodeId: string): string | null {
  return useStore((state) => {
    const inbound = state.edges.filter(e => e.target === nodeId)
    if (inbound.length === 0) return null
    const src = state.nodeLookup.get(inbound[0].source)
    if (!src) return null
    const d = src.data as Record<string, unknown>
    const text = (d.refinedPrompt as string)
      ?? (d.text as string)
      ?? (d.prompt as string)
      ?? null
    return text && text.trim().length > 0 ? text : null
  })
}

/**
 * Variante pra buscar uma IMAGEM upstream (selectedOutput > url > sheetUrl/imageUrl).
 * Retorna null se não há conexão ou nenhum campo de imagem.
 */
export function useUpstreamImage(nodeId: string): string | null {
  return useStore((state) => {
    const inbound = state.edges.filter(e => e.target === nodeId)
    if (inbound.length === 0) return null
    const src = state.nodeLookup.get(inbound[0].source)
    if (!src) return null
    const d = src.data as Record<string, unknown>
    const outputs = d.outputs as Array<{ url: string }> | undefined
    const selectedIndex = (d.selectedIndex as number) ?? 0
    const fromOutputs = outputs?.[selectedIndex]?.url
    return fromOutputs
      ?? (d.url as string)
      ?? (d.sheetUrl as string)
      ?? (d.imageUrl as string)
      ?? null
  })
}
