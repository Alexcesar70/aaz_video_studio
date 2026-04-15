import type { User } from '../domain/User'
import type {
  UserRepository,
  UserListFilter,
} from '../ports/UserRepository'

export async function listUsers(
  deps: { repo: UserRepository },
  filter?: UserListFilter,
): Promise<User[]> {
  return deps.repo.list(filter)
}
