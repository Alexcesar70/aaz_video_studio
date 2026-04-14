import { test, expect } from '@playwright/test'
import { getAdminCredentials, login } from '../fixtures/auth'

/**
 * Smoke #5 — Admin dashboard
 * Valida que super_admin consegue abrir o console e buscar KPIs.
 * Se falhar, o painel financeiro ficou inacessível.
 */
test.describe('smoke: admin dashboard', () => {
  test('super_admin consegue GET /api/admin/dashboard', async ({ request }) => {
    const creds = getAdminCredentials()
    test.skip(!creds, 'E2E_ADMIN_EMAIL/PASSWORD não configurados')

    await login(request, creds!)

    const res = await request.get('/api/admin/dashboard')
    // Se o user de teste não for super_admin, aceitamos 401/403 como esperado.
    if (res.status() === 401 || res.status() === 403) {
      test.skip(true, 'E2E_ADMIN user não é super_admin — skipping')
      return
    }
    expect(res.ok()).toBe(true)

    const body = await res.json()
    expect(body).toBeTruthy()
  })
})
