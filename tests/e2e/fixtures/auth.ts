import type { APIRequestContext } from '@playwright/test'

/**
 * Credenciais para os smoke tests.
 * Se não configuradas, os testes relevantes fazem `test.skip()` — não
 * quebramos CI local só porque env var não está setada.
 */
export function getAdminCredentials() {
  const email = process.env.E2E_ADMIN_EMAIL
  const password = process.env.E2E_ADMIN_PASSWORD
  if (!email || !password) return null
  return { email, password }
}

export function getCreatorCredentials() {
  const email = process.env.E2E_CREATOR_EMAIL
  const password = process.env.E2E_CREATOR_PASSWORD
  if (!email || !password) return null
  return { email, password }
}

export async function login(
  request: APIRequestContext,
  credentials: { email: string; password: string },
) {
  const res = await request.post('/api/auth/login', {
    data: credentials,
  })
  if (!res.ok()) {
    throw new Error(`Login failed (${res.status()}): ${await res.text()}`)
  }
  return res
}
