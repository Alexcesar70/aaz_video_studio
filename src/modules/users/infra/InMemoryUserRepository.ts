import type { User } from '../domain/User'
import { validateUser } from '../domain/User'
import type {
  UserRepository,
  UserListFilter,
} from '../ports/UserRepository'

/**
 * Repository in-memory para testes. Mantém index por email para
 * espelhar a unicidade imposta pelo Postgres/Redis.
 */
export class InMemoryUserRepository implements UserRepository {
  private byId = new Map<string, User>()
  private byEmail = new Map<string, string>() // email → id

  async findById(id: string): Promise<User | null> {
    return this.byId.get(id) ?? null
  }

  async findByEmail(email: string): Promise<User | null> {
    const id = this.byEmail.get(email.toLowerCase())
    if (!id) return null
    return this.byId.get(id) ?? null
  }

  async list(filter?: UserListFilter): Promise<User[]> {
    let items = Array.from(this.byId.values())
    if (filter?.organizationId !== undefined) {
      items = items.filter((u) => u.organizationId === filter.organizationId)
    }
    if (filter?.role) items = items.filter((u) => u.role === filter.role)
    if (filter?.status) items = items.filter((u) => u.status === filter.status)
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (filter?.limit && filter.limit > 0) items = items.slice(0, filter.limit)
    return items
  }

  async upsert(user: User): Promise<User> {
    const validated = validateUser(user)
    // Se o email bate com OUTRO user (id diferente), rejeita
    const existingByEmail = this.byEmail.get(validated.email)
    if (existingByEmail && existingByEmail !== validated.id) {
      throw new Error(
        `Email ${validated.email} já pertence ao user ${existingByEmail}`,
      )
    }
    // Ao atualizar, limpa o email antigo se mudou
    const prev = this.byId.get(validated.id)
    if (prev && prev.email !== validated.email) {
      this.byEmail.delete(prev.email)
    }
    this.byId.set(validated.id, validated)
    this.byEmail.set(validated.email, validated.id)
    return validated
  }

  async remove(id: string): Promise<void> {
    const prev = this.byId.get(id)
    if (prev) this.byEmail.delete(prev.email)
    this.byId.delete(id)
  }

  async touchLastActive(id: string, at: Date = new Date()): Promise<void> {
    const u = this.byId.get(id)
    if (!u) return
    this.byId.set(id, { ...u, lastActiveAt: at.toISOString() })
  }

  clear(): void {
    this.byId.clear()
    this.byEmail.clear()
  }

  size(): number {
    return this.byId.size
  }
}
