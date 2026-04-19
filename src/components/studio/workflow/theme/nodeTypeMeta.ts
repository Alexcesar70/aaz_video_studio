import type { NodeType } from '@/modules/workflow'

/**
 * Metadata visual por tipo de nó — fonte única de cor, ícone e label.
 * Usado pelo NodeShell/NodeHeader, sidebar, handles tipados e edge colors.
 */
export interface NodeTypeMeta {
  /** Cor identitária do tipo (usada em borda, handle, edge) */
  color: string
  /** Ícone compacto (emoji ou caractere) usado no header */
  icon: string
  /** Label padrão do header (quando o nó não passa override) */
  label: string
  /** Categoria semântica — fonte, gerador, transformador, saída */
  category: NodeCategory
  /** Tipo de dado emitido pelo handle de saída (pra tipagem de conexões no PR 3) */
  outputType?: DataType
  /** Tipos aceitos no handle de entrada (pra validação no PR 3) */
  inputTypes?: DataType[]
}

export type NodeCategory = 'source' | 'generator' | 'transformer' | 'asset' | 'output'
export type DataType = 'text' | 'image' | 'video' | 'prompt' | 'any'

export const NODE_TYPE_META: Record<NodeType, NodeTypeMeta> = {
  note: {
    color: '#C6D66E',
    icon: '📝',
    label: 'Nota',
    category: 'source',
    outputType: 'text',
  },
  prompt: {
    color: '#E59866',
    icon: '✨',
    label: 'AI Prompt',
    category: 'generator',
    inputTypes: ['text', 'image'],
    outputType: 'text',
  },
  'smart-prompter': {
    color: '#E59866',
    icon: '✨',
    label: 'Smart Prompter',
    category: 'transformer',
    inputTypes: ['text', 'prompt'],
    outputType: 'prompt',
  },
  image: {
    color: '#8B5CF6',
    icon: '🖼',
    label: 'Imagem',
    category: 'asset',
    inputTypes: ['text', 'image'],
    outputType: 'image',
  },
  video: {
    color: '#06B6D4',
    icon: '▶',
    label: 'Vídeo',
    category: 'generator',
    inputTypes: ['image', 'text', 'video'],
    outputType: 'video',
  },
  reference: {
    color: '#9F9AB8',
    icon: '🔗',
    label: 'Referência',
    category: 'source',
    outputType: 'any',
  },
  character: {
    color: '#D4A0C8',
    icon: '👤',
    label: 'Personagem',
    category: 'asset',
    outputType: 'image',
  },
  scenario: {
    color: '#6366F1',
    icon: '🏞',
    label: 'Cenário',
    category: 'asset',
    outputType: 'image',
  },
  audio: {
    color: '#F472B6',
    icon: '🎵',
    label: 'Áudio',
    category: 'generator',
    inputTypes: ['text', 'prompt'],
    outputType: 'any',
  },
  assistant: {
    color: '#60A5FA',
    icon: '✨',
    label: 'Assistant',
    category: 'transformer',
    inputTypes: ['text', 'prompt', 'image'],
    outputType: 'text',
  },
  list: {
    color: '#A78BFA',
    icon: '📋',
    label: 'Lista',
    category: 'source',
    inputTypes: ['text', 'any'],
    outputType: 'text',
  },
  sticky: {
    color: '#FEF08A',
    icon: '📌',
    label: 'Post-it',
    category: 'output',
  },
  group: {
    color: '#9F9AB8',
    icon: '📦',
    label: 'Grupo',
    category: 'output',
  },
  task: {
    color: '#FBBF24',
    icon: '✅',
    label: 'Tarefa',
    category: 'output',
  },
}

export function getNodeTypeMeta(type: NodeType): NodeTypeMeta {
  return NODE_TYPE_META[type] ?? NODE_TYPE_META.note
}
