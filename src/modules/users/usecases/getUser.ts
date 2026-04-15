import type { User, PublicUser } from '../domain/User'
import { toPublicUser } from '../domain/User'
import type { UserRepository } from '../ports/UserRepository'

export class UserNotFoundError extends Error {
  constructor(idOrEmail: string) {
    super(`User not found: ${idOrEmail}`)
    this.name = 'UserNotFoundError'
  }
}

export async function getUserById(
  deps: { repo: UserRepository },
  id: string,
): Promise<User | null> {
  return deps.repo.findById(id)
}

export async function getUserByEmail(
  deps: { repo: UserRepository },
  email: string,
): Promise<User | null> {
  return deps.repo.findByEmail(email)
}

export async function getPublicUserById(
  deps: { repo: UserRepository },
  id: string,
): Promise<PublicUser | null> {
  const u = await getUserById(deps, id)
  return u ? toPublicUser(u) : null
}

export async function getUserByIdOrThrow(
  deps: { repo: UserRepository },
  id: string,
): Promise<User> {
  const u = await deps.repo.findById(id)
  if (!u) throw new UserNotFoundError(id)
  return u
}
