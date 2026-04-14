import { test, expect } from '@playwright/test'
import { getAdminCredentials, login } from '../fixtures/auth'

/**
 * Smoke #1 — Login
 * Valida que auth + cookie + /api/auth/me continuam funcionando.
 * É o teste mais crítico: se falhar, todos os outros são inúteis.
 */
test.describe('smoke: login', () => {
  test('admin consegue fazer login e /me retorna o usuário', async ({
    request,
  }) => {
    const creds = getAdminCredentials()
    test.skip(!creds, 'E2E_ADMIN_EMAIL/PASSWORD não configurados')

    const loginRes = await login(request, creds!)
    expect(loginRes.ok()).toBe(true)

    const me = await request.get('/api/auth/me')
    expect(me.ok()).toBe(true)
    const body = await me.json()
    expect(body.email).toBe(creds!.email)
  })

  test('login com senha errada é rejeitado', async ({ request }) => {
    const creds = getAdminCredentials()
    test.skip(!creds, 'E2E_ADMIN_EMAIL/PASSWORD não configurados')

    const res = await request.post('/api/auth/login', {
      data: { email: creds!.email, password: 'senha-errada-xyz' },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(res.status()).toBeLessThan(500)
  })
})
