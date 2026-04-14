import { test, expect } from '@playwright/test'
import { getAdminCredentials, login } from '../fixtures/auth'

/**
 * Smoke #3 — Wallet
 * Valida que /api/me/wallet continua respondendo com o shape esperado.
 * O M1 NÃO pode quebrar o contrato da wallet em momento algum.
 */
test.describe('smoke: wallet', () => {
  test('usuário logado consegue ler /api/me/wallet', async ({ request }) => {
    const creds = getAdminCredentials()
    test.skip(!creds, 'E2E_ADMIN_EMAIL/PASSWORD não configurados')

    await login(request, creds!)

    const res = await request.get('/api/me/wallet')
    expect(res.ok()).toBe(true)

    const body = await res.json()
    // Aceita tanto o shape atual quanto legados mínimos.
    // Não assertamos valor — só presença.
    expect(body).toBeTruthy()
    const hasBalance =
      typeof body.balanceUsd === 'number' ||
      typeof body?.wallet?.balanceUsd === 'number' ||
      typeof body.balance === 'number'
    expect(hasBalance, `wallet response missing balance: ${JSON.stringify(body)}`).toBe(true)
  })
})
