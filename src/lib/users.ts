/**
 * Modelo de usuários do AAZ Studio (multi-user).
 *
 * LEAD_ADMIN_EMAIL é o admin padrão criado automaticamente na primeira
 * inicialização se o Redis estiver vazio (sem nenhum aaz:user:*).
 * Herda a senha atual do SITE_PASSWORD como bootstrap — o admin pode
 * trocar depois via /api/users/[id] (endpoint de reset de senha).
 *
 * Senhas são hasheadas com bcryptjs (pure JS, zero native deps).
 */

import bcrypt from 'bcryptjs'
import { getRedis } from './redis'

export type UserRole = 'super_admin' | 'admin' | 'creator'
export type UserStatus = 'active' | 'revoked'

export interface User {
  /** Slug único, geralmente derivado do email */
  id: string
  email: string
  name: string
  role: UserRole
  status: UserStatus
  /** Hash bcrypt da senha. NUNCA retornar em APIs públicas. */
  passwordHash: string
  /** Budget mensal opcional em USD (null = sem cap) */
  monthlyBudgetUsd?: number
  /** IDs dos projetos que o creator pode ver/editar. Admin vê tudo sempre. */
  assignedProjectIds?: string[]
  /** ID da organização à qual o usuário pertence */
  organizationId?: string
  /** Permissões granulares (ex: 'manage_users', 'manage_billing') */
  permissions?: string[]
  /** Produtos que o usuário pode acessar (ex: 'aaz_studio', 'courses') */
  products?: string[]
  createdAt: string
  lastActiveAt?: string
  /** ID do admin que criou. 'system' pro bootstrap inicial. */
  createdBy: string
}

/** User sem o hash — formato seguro pra retornar ao cliente */
export type PublicUser = Omit<User, 'passwordHash'>

export const USER_PREFIX = 'aaz:user:'
export const USER_EMAIL_INDEX = 'aaz:user_email:'

/** Email do admin bootstrap definido pelo criador do projeto */
export const LEAD_ADMIN_EMAIL = 'contato@qiqnada.com.br'
export const LEAD_ADMIN_NAME = 'Alexandre'
export const LEAD_ADMIN_ID = 'alexandre'

/**
 * Remove caracteres especiais e cria um id válido pra usar como chave Redis.
 * "Maria Silva" → "maria_silva"
 * "joao@gmail.com" → "joao_gmail_com"
 */
export function slugifyUserId(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'user'
}

/**
 * Gera uma senha aleatória forte (16 chars alfanuméricos + símbolos seguros).
 * Usado quando admin cria um novo usuário.
 */
export function generatePassword(length = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-_'
  let out = ''
  const crypto = globalThis.crypto
  const arr = new Uint32Array(length)
  crypto.getRandomValues(arr)
  for (let i = 0; i < length; i++) {
    out += chars[arr[i] % chars.length]
  }
  return out
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Converte um User completo (com hash) em PublicUser (seguro para
 * retornar ao cliente).
 */
export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _ph, ...rest } = user
  void _ph
  return rest
}

/**
 * Carrega um usuário pelo id. Retorna null se não existir.
 */
export async function getUserById(id: string): Promise<User | null> {
  const redis = await getRedis()
  const val = await redis.get(`${USER_PREFIX}${id}`)
  if (!val) return null
  try {
    return JSON.parse(val) as User
  } catch {
    return null
  }
}

/**
 * Carrega um usuário pelo email. Retorna null se não existir.
 * Usa o índice secundário `aaz:user_email:{email} → id`.
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const redis = await getRedis()
  const id = await redis.get(`${USER_EMAIL_INDEX}${email.toLowerCase()}`)
  if (!id) return null
  return getUserById(id)
}

/**
 * Lista todos os usuários (retorna PublicUser, sem hash).
 * Ordenados por createdAt desc.
 */
export async function listUsers(): Promise<PublicUser[]> {
  const redis = await getRedis()
  const keys = await redis.keys(`${USER_PREFIX}*`)
  const users: User[] = []
  for (const key of keys) {
    const val = await redis.get(key)
    if (val) {
      try {
        users.push(JSON.parse(val) as User)
      } catch {}
    }
  }
  users.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  return users.map(toPublicUser)
}

/**
 * Cria um novo usuário. Valida unicidade do email. Hasheia a senha.
 * Retorna o usuário criado (com PublicUser shape + a senha em claro
 * APENAS na resposta dessa função — usada pelo admin pra copiar e
 * enviar ao novo criador).
 */
export async function createUser(params: {
  name: string
  email: string
  role: UserRole
  password?: string // se não vier, gera uma aleatória
  monthlyBudgetUsd?: number
  assignedProjectIds?: string[]
  organizationId?: string
  permissions?: string[]
  products?: string[]
  createdBy: string
}): Promise<{ user: PublicUser; plainPassword: string }> {
  const email = params.email.trim().toLowerCase()
  if (!email || !params.name.trim()) {
    throw new Error('Nome e email são obrigatórios.')
  }
  if (!/.+@.+/.test(email)) {
    throw new Error('Email inválido.')
  }

  const existing = await getUserByEmail(email)
  if (existing) {
    throw new Error(`Já existe um usuário com email ${email}.`)
  }

  const plainPassword = params.password ?? generatePassword()
  const passwordHash = await hashPassword(plainPassword)

  // ID = slug do nome, mas garante unicidade concatenando timestamp curto
  // se colidir com user existente
  let id = slugifyUserId(params.name)
  const existingById = await getUserById(id)
  if (existingById) {
    id = `${id}_${Date.now().toString(36).slice(-4)}`
  }

  const now = new Date().toISOString()
  const user: User = {
    id,
    email,
    name: params.name.trim(),
    role: params.role,
    status: 'active',
    passwordHash,
    monthlyBudgetUsd: params.monthlyBudgetUsd,
    assignedProjectIds: params.assignedProjectIds,
    organizationId: params.organizationId,
    permissions: params.permissions,
    products: params.products,
    createdAt: now,
    createdBy: params.createdBy,
  }

  const redis = await getRedis()
  await redis.set(`${USER_PREFIX}${id}`, JSON.stringify(user))
  await redis.set(`${USER_EMAIL_INDEX}${email}`, id)

  return { user: toPublicUser(user), plainPassword }
}

/**
 * Atualiza campos de um usuário. Senha só é alterada se `newPassword`
 * for fornecida (não passa por este objeto — use resetPassword).
 */
export async function updateUser(
  id: string,
  updates: Partial<Pick<User, 'name' | 'email' | 'role' | 'status' | 'monthlyBudgetUsd' | 'assignedProjectIds' | 'lastActiveAt' | 'organizationId' | 'permissions' | 'products'>>
): Promise<PublicUser | null> {
  const current = await getUserById(id)
  if (!current) return null

  // Se o email mudou, atualiza o índice secundário
  if (updates.email && updates.email.toLowerCase() !== current.email) {
    const newEmail = updates.email.toLowerCase()
    const conflict = await getUserByEmail(newEmail)
    if (conflict && conflict.id !== id) {
      throw new Error(`Já existe outro usuário com email ${newEmail}.`)
    }
    const redis = await getRedis()
    await redis.del(`${USER_EMAIL_INDEX}${current.email}`)
    await redis.set(`${USER_EMAIL_INDEX}${newEmail}`, id)
    updates.email = newEmail
  }

  const updated: User = {
    ...current,
    ...updates,
  }

  const redis = await getRedis()
  await redis.set(`${USER_PREFIX}${id}`, JSON.stringify(updated))

  return toPublicUser(updated)
}

/**
 * Redefine a senha de um usuário. Gera uma nova aleatória se plainPassword
 * for undefined. Retorna a senha em claro pra exibição one-time.
 */
export async function resetPassword(
  id: string,
  plainPassword?: string
): Promise<{ user: PublicUser; plainPassword: string } | null> {
  const current = await getUserById(id)
  if (!current) return null

  const newPlain = plainPassword ?? generatePassword()
  const passwordHash = await hashPassword(newPlain)

  const updated: User = { ...current, passwordHash }
  const redis = await getRedis()
  await redis.set(`${USER_PREFIX}${id}`, JSON.stringify(updated))

  return { user: toPublicUser(updated), plainPassword: newPlain }
}

/**
 * Revoga o acesso de um usuário (mantém no Redis pra histórico, mas
 * marca como revoked). Login vai falhar pra ele.
 */
export async function revokeUser(id: string): Promise<PublicUser | null> {
  return updateUser(id, { status: 'revoked' })
}

/**
 * Reativa um usuário revogado.
 */
export async function reactivateUser(id: string): Promise<PublicUser | null> {
  return updateUser(id, { status: 'active' })
}

/**
 * Deleta definitivamente um usuário (hard delete). Cuidado — perde histórico.
 * Não recomendado — prefira revokeUser.
 */
export async function deleteUser(id: string): Promise<boolean> {
  const current = await getUserById(id)
  if (!current) return false
  const redis = await getRedis()
  await redis.del(`${USER_PREFIX}${id}`)
  await redis.del(`${USER_EMAIL_INDEX}${current.email}`)
  return true
}

/**
 * Toca lastActiveAt do usuário — chamado pelo middleware quando o
 * usuário autenticado faz alguma request.
 */
export async function touchLastActive(id: string): Promise<void> {
  const current = await getUserById(id)
  if (!current) return
  current.lastActiveAt = new Date().toISOString()
  const redis = await getRedis()
  await redis.set(`${USER_PREFIX}${id}`, JSON.stringify(current))
}

/**
 * Bootstrap do admin — cria o admin padrão se nenhum usuário existir.
 * Idempotente: se já houver usuários no Redis, retorna null.
 *
 * A senha inicial é herdada do SITE_PASSWORD (env var antiga). O admin
 * pode trocar a senha depois via reset. Isso preserva retrocompat com
 * a auth single-password — você loga com seu email + a senha antiga.
 */
export async function bootstrapAdminIfEmpty(): Promise<{ user: PublicUser; plainPassword: string } | null> {
  const redis = await getRedis()
  const keys = await redis.keys(`${USER_PREFIX}*`)
  if (keys.length > 0) return null

  const sitePassword = process.env.SITE_PASSWORD
  if (!sitePassword) {
    throw new Error(
      'Bootstrap de admin falhou: SITE_PASSWORD não configurado. ' +
      'Defina a variável de ambiente antes do primeiro login.'
    )
  }

  const passwordHash = await hashPassword(sitePassword)
  const now = new Date().toISOString()
  const user: User = {
    id: LEAD_ADMIN_ID,
    email: LEAD_ADMIN_EMAIL,
    name: LEAD_ADMIN_NAME,
    role: 'super_admin',    status: 'active',
    passwordHash,
    createdAt: now,
    createdBy: 'system',
  }

  await redis.set(`${USER_PREFIX}${user.id}`, JSON.stringify(user))
  await redis.set(`${USER_EMAIL_INDEX}${user.email}`, user.id)

  console.log(`[users] Bootstrap admin criado: ${user.email} (senha = SITE_PASSWORD)`)

  return { user: toPublicUser(user), plainPassword: sitePassword }
}

/**
 * Lista todos os usuários de uma organização (retorna PublicUser, sem hash).
 * Ordenados por createdAt descendente.
 *
 * @param orgId ID da organização
 * @returns Lista de usuários públicos da organização
 */
export async function getUsersByOrganization(orgId: string): Promise<PublicUser[]> {
  const redis = await getRedis()
  const keys = await redis.keys(`${USER_PREFIX}*`)
  const users: User[] = []

  for (const key of keys) {
    const val = await redis.get(key)
    if (val) {
      try {
        const user = JSON.parse(val) as User
        if (user.organizationId === orgId) {
          users.push(user)
        }
      } catch { /* skip malformed */ }
    }
  }

  users.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  return users.map(toPublicUser)
}
