/**
 * Constantes visuais compartilhadas do Workflow.
 * Única fonte pra superfícies, bordas, sombras e plano de fundo — evita
 * espalhar hex codes pelos nós.
 */

export const wfColors = {
  /** Fundo base do canvas (sólido de fallback) */
  canvasBase: '#0A0814',
  /** Topo do gradient radial do canvas */
  canvasTop: '#140E28',
  /** Superfície de cards (nós, toolbar, sidebar) */
  surface: '#14111F',
  /** Superfície interna (textareas, inputs dentro de nós) */
  surfaceDeep: '#0B0915',
  /** Borda padrão de elementos */
  border: '#2A2545',
  /** Borda hover/selected sutil */
  borderStrong: '#3B3562',
  /** Texto principal */
  text: '#E8E5F0',
  /** Texto secundário */
  textDim: '#9F9AB8',
  /** Texto terciário (placeholder) */
  textFaint: '#6B6688',
  /** Cor padrão de edges quando tipo desconhecido */
  edgeDefault: '#7F77DD',
  /** Cor do "pôr do sol" do logo — usada em glow de geração */
  glow: '#F97316',
} as const

export const wfRadius = {
  card: 14,
  inner: 8,
  control: 6,
  handle: 999,
} as const

export const wfShadow = {
  card: '0 4px 14px rgba(0,0,0,0.35)',
  cardSelected: (color: string) => `0 0 0 2px ${color}35, 0 12px 32px rgba(0,0,0,0.5)`,
  toolbar: '0 8px 24px rgba(0,0,0,0.55)',
  menu: '0 12px 32px rgba(0,0,0,0.6)',
} as const

/**
 * Gradient radial usado no fundo do canvas — puxa um roxo escuro no topo-esquerda
 * que dissolve no preto. Aplicado como `background` do container `<ReactFlow>`.
 */
export const wfCanvasBackground =
  `radial-gradient(ellipse 1200px 800px at 20% -10%, ${wfColors.canvasTop} 0%, ${wfColors.canvasBase} 55%)`

/**
 * Gap entre pontos do grid de fundo (passa pro <Background> do xyflow).
 */
export const wfGridGap = 22
export const wfGridColor = '#1E1934'
