/**
 * RedisProjectRepository — adapter envolvendo as chaves legadas
 * `aaz:project:*` no contrato `ProjectRepository`.
 *
 * **Sentinel para legacy data:** o shape antigo permitia
 * `organizationId` opcional. Itens sem orgId existem em produção
 * (criados antes do multi-tenant). Para encaixar no domínio novo
 * (que requer `workspaceId: string`), mapeamos missing → sentinel
 * `LEGACY_WORKSPACE_ID = '__legacy__'`.
 *
 * Quem quiser ver legacy data junto com a do próprio workspace
 * usa o helper `listProjectsLegacyAware` (futuro). Por enquanto,
 * filter `{ workspaceId: orgId }` retorna apenas itens do próprio
 * workspace; legacy não aparece. Isso casa com o modelo Postgres
 * (que exige FK válida).
 *
 * Backfill pode reconciliar:
 *   - projetos com `__legacy__`: assign à org do criador (lookup
 *     pelo `createdBy.organizationId`).
 */

import { getRedis } from '@/lib/redis'
import type { Project } from '../domain/Project'
import { validateProject } from '../domain/Project'
import type {
  ProjectRepository,
  ProjectListFilter,
} from '../ports/ProjectRepository'

const PREFIX = 'aaz:project:'
export const LEGACY_WORKSPACE_ID = '__legacy__'

interface LegacyShape {
  id: string
  name: string
  createdAt: string
  createdBy?: string
  memberIds?: string[]
  organizationId?: string
  updatedAt?: string
}

function fromRedis(raw: string): Project | null {
  try {
    const obj = JSON.parse(raw) as LegacyShape
    return validateProject({
      id: obj.id,
      name: obj.name,
      workspaceId: obj.organizationId ?? LEGACY_WORKSPACE_ID,
      createdBy: obj.createdBy ?? 'system',
      memberIds: obj.memberIds ?? [],
      createdAt: obj.createdAt,
      updatedAt: obj.updatedAt ?? obj.createdAt,
    })
  } catch {
    return null
  }
}

function toRedis(project: Project): string {
  // Preserva shape legado: organizationId opcional, sem updatedAt
  // se for sentinel legacy.
  const legacy: LegacyShape = {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt,
    createdBy: project.createdBy,
    memberIds: project.memberIds,
  }
  if (project.workspaceId !== LEGACY_WORKSPACE_ID) {
    legacy.organizationId = project.workspaceId
  }
  // updatedAt entra só se diferente do createdAt
  if (project.updatedAt && project.updatedAt !== project.createdAt) {
    legacy.updatedAt = project.updatedAt
  }
  return JSON.stringify(legacy)
}

export class RedisProjectRepository implements ProjectRepository {
  async findById(id: string): Promise<Project | null> {
    const redis = await getRedis()
    const raw = await redis.get(`${PREFIX}${id}`)
    return raw ? fromRedis(raw) : null
  }

  async list(filter?: ProjectListFilter): Promise<Project[]> {
    const redis = await getRedis()
    const keys = await redis.keys(`${PREFIX}*`)
    const items: Project[] = []
    for (const key of keys) {
      const raw = await redis.get(key)
      if (!raw) continue
      const p = fromRedis(raw)
      if (!p) continue
      if (filter?.workspaceId && p.workspaceId !== filter.workspaceId) continue
      if (filter?.createdBy && p.createdBy !== filter.createdBy) continue
      if (filter?.memberId && !p.memberIds.includes(filter.memberId)) continue
      items.push(p)
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (filter?.limit && filter.limit > 0) return items.slice(0, filter.limit)
    return items
  }

  async upsert(project: Project): Promise<Project> {
    const validated = validateProject(project)
    const redis = await getRedis()
    await redis.set(`${PREFIX}${validated.id}`, toRedis(validated))
    return validated
  }

  async remove(id: string): Promise<void> {
    const redis = await getRedis()
    await redis.del(`${PREFIX}${id}`)
  }
}
