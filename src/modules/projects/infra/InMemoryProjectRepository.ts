import type { Project } from '../domain/Project'
import { validateProject } from '../domain/Project'
import type {
  ProjectRepository,
  ProjectListFilter,
} from '../ports/ProjectRepository'

export class InMemoryProjectRepository implements ProjectRepository {
  private store = new Map<string, Project>()

  async findById(id: string): Promise<Project | null> {
    return this.store.get(id) ?? null
  }

  async list(filter?: ProjectListFilter): Promise<Project[]> {
    let items = Array.from(this.store.values())
    if (filter?.workspaceId) {
      items = items.filter((p) => p.workspaceId === filter.workspaceId)
    }
    if (filter?.createdBy) {
      items = items.filter((p) => p.createdBy === filter.createdBy)
    }
    if (filter?.memberId) {
      items = items.filter((p) => p.memberIds.includes(filter.memberId!))
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (filter?.limit && filter.limit > 0) items = items.slice(0, filter.limit)
    return items
  }

  async upsert(project: Project): Promise<Project> {
    const validated = validateProject(project)
    this.store.set(validated.id, validated)
    return validated
  }

  async remove(id: string): Promise<void> {
    this.store.delete(id)
  }

  clear(): void {
    this.store.clear()
  }
}
