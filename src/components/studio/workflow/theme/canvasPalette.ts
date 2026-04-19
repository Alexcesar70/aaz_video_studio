/**
 * Paleta de cores pro background do canvas do Workflow.
 * Grid 8 × 6 = 48 cores geradas programaticamente em HSL, cobrindo:
 *   - linha 0: neutros (preto → cinza-claro)
 *   - linhas 1-5: 8 hues × 5 níveis de luminosidade (escuros até médios)
 *
 * Todas no tom dark-friendly — canvas não deve "brilhar" no
 * branco/pastel pra não competir com os cards.
 */

export interface CanvasBackground {
  /** Valor CSS pra aplicar em `background` */
  value: string
  /** Rótulo curto pra tooltip */
  label: string
  /** Preview sólido pra renderizar na swatch (mesmo quando value é gradient) */
  swatch: string
}

/**
 * Gradient original do Bear Studio — puxa roxo no topo-esquerdo,
 * dissolvendo no preto. Default.
 */
export const DEFAULT_CANVAS_BG: CanvasBackground = {
  value: 'radial-gradient(ellipse 1200px 800px at 20% -10%, #1F1A30 0%, #14121F 55%)',
  label: 'Bear (padrão)',
  swatch: '#1F1A30',
}

/**
 * Gera o grid de swatches sólidos. Cada linha é um nível de luminosidade,
 * cada coluna é uma hue diferente.
 */
function generatePalette(): CanvasBackground[][] {
  const rows: CanvasBackground[][] = []

  // Linha 0: neutros cinza
  const grays = Array.from({ length: 8 }, (_, i) => {
    const l = 4 + i * 7 // 4..53
    const v = `hsl(250, 6%, ${l}%)`
    return { value: v, swatch: v, label: `Cinza ${l}%` }
  })
  rows.push(grays)

  // Linhas 1-5: hues × lightness (tons escuros principalmente)
  const hues = [0, 20, 45, 120, 180, 220, 260, 320] // vermelho, laranja, amarelo, verde, ciano, azul, roxo, rosa
  const lightnesses = [10, 16, 22, 30, 40]

  for (const l of lightnesses) {
    const row = hues.map(h => {
      const v = `hsl(${h}, 48%, ${l}%)`
      return { value: v, swatch: v, label: `H${h} L${l}%` }
    })
    rows.push(row)
  }

  return rows
}

export const CANVAS_PALETTE: CanvasBackground[][] = generatePalette()

/** Key no localStorage onde persiste a escolha */
export const CANVAS_BG_STORAGE_KEY = 'wf-canvas-bg'
