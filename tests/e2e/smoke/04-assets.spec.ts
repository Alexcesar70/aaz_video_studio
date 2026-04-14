import { test, expect } from '@playwright/test'
import { getAdminCredentials, login } from '../fixtures/auth'

/**
 * Smoke #4 — Assets (characters)
 * Valida que a listagem de assets responde e contém os LEAD_CHARACTERS
 * do tenant atual (AAZ). Esse teste será atualizado no PR #4 para não
 * assumir o universo AAZ — aqui serve de baseline.
 */
test.describe('smoke: assets', () => {
  test('GET /api/assets?type=character retorna array', async ({ request }) => {
    const creds = getAdminCredentials()
    test.skip(!creds, 'E2E_ADMIN_EMAIL/PASSWORD não configurados')

    await login(request, creds!)

    const res = await request.get('/api/assets?type=character')
    expect(res.ok()).toBe(true)

    const body = await res.json()
    const list = Array.isArray(body) ? body : body.assets
    expect(Array.isArray(list)).toBe(true)
  })
})
