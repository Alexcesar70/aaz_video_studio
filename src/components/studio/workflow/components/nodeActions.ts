import type { NodeAction } from './NodeActionsToolbar'
import type { WorkflowContextValue } from '../WorkflowContext'

/**
 * Factory de ações padrão (duplicate/delete) que todo nó deveria expor.
 * Abstrai a dependência do WorkflowContext — o nó passa o id + as funções,
 * a factory devolve a lista pronta pra consumir em <NodeActionsToolbar>.
 *
 * @example
 * const { duplicateNode, deleteNode } = useWorkflow()
 * const actions = [
 *   ...myCustomActions,
 *   ...standardNodeActions(id, { duplicateNode, deleteNode }),
 * ]
 */
export function standardNodeActions(
  nodeId: string,
  ctx: Pick<WorkflowContextValue, 'duplicateNode' | 'deleteNode'>,
): NodeAction[] {
  return [
    {
      id: 'duplicate',
      icon: '⎘',
      title: 'Duplicar (⌘D)',
      onClick: () => ctx.duplicateNode(nodeId),
    },
    {
      id: 'delete',
      icon: '✕',
      title: 'Deletar (Del)',
      tone: 'danger',
      onClick: () => ctx.deleteNode(nodeId),
    },
  ]
}

/**
 * Action helper pra download de um asset (imagem/vídeo) em URL.
 * Abre nova aba — delegamos download ao navegador. Útil pra ImageNode/VideoNode.
 */
export function downloadAction(url: string | undefined, filename = 'asset'): NodeAction | null {
  if (!url) return null
  return {
    id: 'download',
    icon: '⬇',
    title: 'Baixar',
    onClick: () => {
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.target = '_blank'
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    },
  }
}

/**
 * Action helper pra abrir URL externa (ReferenceNode).
 */
export function openLinkAction(url: string | undefined): NodeAction | null {
  if (!url) return null
  return {
    id: 'open',
    icon: '↗',
    title: 'Abrir em nova aba',
    onClick: () => {
      window.open(url, '_blank', 'noopener,noreferrer')
    },
  }
}
