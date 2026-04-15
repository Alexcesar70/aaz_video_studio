import type { Workspace } from '../domain/Workspace'
import type { WorkspaceRepository } from '../ports/WorkspaceRepository'

export class WorkspaceNotFoundError extends Error {
  constructor(key: string) {
    super(`Workspace not found: ${key}`)
    this.name = 'WorkspaceNotFoundError'
  }
}

export async function getWorkspace(
  deps: { repo: WorkspaceRepository },
  params: { id?: string; slug?: string },
): Promise<Workspace | null> {
  if (params.id) return deps.repo.findById(params.id)
  if (params.slug) return deps.repo.findBySlug(params.slug)
  return null
}

export async function getWorkspaceOrThrow(
  deps: { repo: WorkspaceRepository },
  params: { id?: string; slug?: string },
): Promise<Workspace> {
  const ws = await getWorkspace(deps, params)
  if (!ws) {
    throw new WorkspaceNotFoundError(params.id ?? params.slug ?? 'unknown')
  }
  return ws
}
